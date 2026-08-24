#!/usr/bin/env bash
#
# Deploy an AtlasForge static export to S3 and CloudFront
#
# Run this on the machine that holds the complete export. The script uploads only
# changed files and does not delete coverage, GWAS, or structure data
#
#   scripts/deploy.sh                 # sync site/ -> the bucket, then invalidate
#   scripts/deploy.sh --dry-run       # show every action, change nothing
#   scripts/deploy.sh --prune         # also delete stale assets + removed HTML/JSON
#   scripts/deploy.sh --site out/     # a different export dir
#
# Override the default CloudFront distribution with:
#   export CLOUDFRONT_DISTRIBUTION_ID=EXXXXXXXXXXXX

set -euo pipefail

BUCKET="s3://slc.yalepages.org"
DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E3885KZHROH1N2}"
SITE_DIR="site"

ASSET_CACHE="public, max-age=31536000, immutable"
BIN_CACHE="public, max-age=604800"
APP_CACHE="no-cache"

# These data trees are never pruned
BINARY_DIRS=(
  "api/browser/coverage"
  "api/browser/gwas"
  "api/structure/models"
)
MODELS_BB="api/browser/models.bb"

DRY_RUN=0
PRUNE=0
DRY_RUN_ARGS=()
DELETE_ARGS=()

usage() {
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      DRY_RUN_ARGS=(--dryrun)
      ;;
    --prune)
      PRUNE=1
      DELETE_ARGS=(--delete)
      ;;
    --site)
      [ "$#" -ge 2 ] || fail "--site requires a path"
      SITE_DIR="$2"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown argument: $1" >&2
      echo "Run '$0 --help' for usage." >&2
      exit 2
      ;;
  esac
  shift
done

command -v aws >/dev/null 2>&1 || fail "AWS CLI not found on PATH"
[ -d "$SITE_DIR" ] || fail "Site directory '$SITE_DIR' not found"

# Verify the export before uploading anything
for required in index.html api/genes.json api/capabilities.json; do
  if [ ! -f "$SITE_DIR/$required" ]; then
    echo "Error: '$SITE_DIR/$required' is missing; '$SITE_DIR' is not a complete export." >&2
    echo "Run 'atlasforge export $SITE_DIR --web-dir web/dist' first." >&2
    exit 1
  fi
done

MODE="live"
[ "$DRY_RUN" -eq 1 ] && MODE="dry run"
[ "$PRUNE" -eq 1 ] && MODE="$MODE with pruning"

echo "Bucket:       $BUCKET"
echo "Site:         $SITE_DIR"
echo "Distribution: $DISTRIBUTION_ID"
echo "Mode:         $MODE"
echo

CHANGED_PATHS=()

run_sync() {
  if ! aws s3 sync "$@"; then
    fail "Sync failed: $*"
  fi
}

run_tracked_sync() {
  local invalidation_path="$1"
  local log
  shift

  log="$(mktemp)"
  if ! aws s3 sync "$@" | tee "$log"; then
    rm -f "$log"
    fail "Sync failed for $invalidation_path"
  fi
  if grep -qE '(upload|copy|delete):' "$log"; then
    CHANGED_PATHS+=("$invalidation_path")
  fi
  rm -f "$log"
}

sync_binary_tree() {
  local sub="$1"
  local source="$SITE_DIR/$sub"

  if [ ! -d "$source" ] || [ -z "$(ls -A "$source" 2>/dev/null)" ]; then
    echo ">> Skipping $sub (missing or empty locally; remote files are unchanged)"
    return
  fi

  echo ">> Binary data: $sub"
  run_tracked_sync "/$sub/*" "$source" "$BUCKET/$sub" "${DRY_RUN_ARGS[@]}" \
    --size-only --cache-control "$BIN_CACHE"
}

echo ">> Assets (immutable cache)"
run_sync "$SITE_DIR/assets/" "$BUCKET/assets/" "${DRY_RUN_ARGS[@]}" "${DELETE_ARGS[@]}" \
  --size-only --cache-control "$ASSET_CACHE"
echo

for dir in "${BINARY_DIRS[@]}"; do
  sync_binary_tree "$dir"
done

# Sync the model index without touching neighboring data trees
if [ -f "$SITE_DIR/$MODELS_BB" ]; then
  echo ">> Binary data: $MODELS_BB"
  run_tracked_sync "/$MODELS_BB" "$SITE_DIR/api/browser/" "$BUCKET/api/browser/" \
    "${DRY_RUN_ARGS[@]}" --exclude "*" --include "models.bb" --size-only \
    --cache-control "$BIN_CACHE"
fi
echo

# Upload entry points last, after their assets are available

echo ">> App and API (no cache)"
run_sync "$SITE_DIR/" "$BUCKET/" "${DRY_RUN_ARGS[@]}" "${DELETE_ARGS[@]}" \
  --cache-control "$APP_CACHE" \
  --exclude "assets/*" \
  --exclude "api/browser/coverage/*" \
  --exclude "api/browser/gwas/*" \
  --exclude "api/structure/models/*" \
  --exclude "api/browser/models.bb"
echo

# Invalidate changed files that use stable URLs and long cache lifetimes

INVAL_PATHS=()
if [ ${#CHANGED_PATHS[@]} -gt 0 ]; then
  while IFS= read -r p; do
    INVAL_PATHS+=("$p")
  done < <(printf '%s\n' "${CHANGED_PATHS[@]}" | awk 'NF && !seen[$0]++')
fi

if [ ${#INVAL_PATHS[@]} -eq 0 ]; then
  echo ">> No binary files changed; no invalidation is needed"
elif [ "$DRY_RUN" -eq 1 ]; then
  echo "[dry run] Would invalidate ${#INVAL_PATHS[@]} path(s): ${INVAL_PATHS[*]}"
elif [ "$DISTRIBUTION_ID" = "REPLACE_WITH_DISTRIBUTION_ID" ]; then
  echo "No CloudFront distribution is set; skipping invalidation."
  echo "Set CLOUDFRONT_DISTRIBUTION_ID and rerun, or invalidate manually:"
  echo "  aws cloudfront create-invalidation --distribution-id <ID> \\"
  echo "    --paths ${INVAL_PATHS[*]}"
else
  echo ">> Invalidating ${#INVAL_PATHS[@]} path(s)"
  if ! aws cloudfront create-invalidation \
        --distribution-id "$DISTRIBUTION_ID" \
        --paths "${INVAL_PATHS[@]}" \
        --query 'Invalidation.{Id:Id,Status:Status}' --output table; then
    echo "Warning: Invalidation failed (is cloudfront:CreateInvalidation permitted?)." >&2
    echo "Content was uploaded. HTML and JSON use no-cache and will still refresh." >&2
    echo "To invalidate the binary files manually, run:" >&2
    echo "  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID \\" >&2
    echo "    --paths ${INVAL_PATHS[*]}" >&2
  fi
fi

echo
echo "Deployment complete."
