#!/usr/bin/env bash
# Measure hosting, client bundle, and Python installation sizes
set -u
REPO=/workspace
OUT=$REPO/scripts/benchmarks/results/footprint.txt
mb() { du -sb "$1" 2>/dev/null | awk '{printf "%.2f MiB", $1/1048576}'; }
b()  { du -sb "$1" 2>/dev/null | awk '{print $1}'; }
{
  echo "# footprint  $(date -Iseconds)"
  echo "## hosting modes (bytes)"
  CLEAN=/workspace/.bench-footprint
  rm -rf "$CLEAN"
  ATLASFORGE_NO_PROGRESS=1 atlasforge export "$CLEAN" --data-dir "$REPO/data" --web-dir "$REPO/web/dist" >/dev/null
  total=$(b "$CLEAN"); cov=$(b "$CLEAN/api/browser/coverage")
  gwas=$(b "$CLEAN/api/browser/gwas"); sm=$(b "$CLEAN/api/structure/models")
  echo "full_local_mirror      $total"
  echo "remote_coverage        $((total-cov))"
  echo "remote_cov+structure   $((total-cov-sm))"
  echo "content_only(no gwas)  $((total-cov-sm-gwas))"
  rm -rf "$CLEAN"
  echo "## client bundles"
  echo "atlasforge web/dist   $(mb $REPO/web/dist)  (gzip: $(cat $REPO/web/dist/assets/*.js | gzip -c | wc -c | awk '{printf "%.2f MiB", $1/1048576}'))"
  echo "igv.js                $(mb $REPO/scripts/benchmarks/node_modules/igv/dist/igv.min.js)"
  echo "jbrowse-web static    $(mb $REPO/scripts/benchmarks/browser/jbrowse-web/static)"
  echo "## atlasforge python install (clean venvs)"
  echo "package alone (src)   $(du -sb --exclude=__pycache__ $REPO/src/atlasforge | awk '{printf "%.2f MiB", $1/1048576}')"
  tmp=$(mktemp -d)
  python -m venv "$tmp/serve" && "$tmp/serve/bin/pip" install -q \
    "fastapi[standard]>=0.115" "uvicorn[standard]>=0.32" "polars>=1.0" "pyarrow>=17" \
    "pydantic>=2.8" "pydantic-settings>=2.5" "rich>=13" >/dev/null 2>&1
  echo "+ serve deps          $(mb $tmp/serve/lib/python*/site-packages)"
  "$tmp/serve/bin/pip" install -q "biopython>=1.83" "scipy>=1.13" "numpy>=1.26" "pybigtools>=0.3" >/dev/null 2>&1
  echo "+ build deps          $(mb $tmp/serve/lib/python*/site-packages)"
  echo "## atlasforge python download (wheels)"
  mkdir -p "$tmp/ws" "$tmp/wp"
  python -m pip download -q -d "$tmp/ws" "fastapi[standard]>=0.115" "uvicorn[standard]>=0.32" \
    "polars>=1.0" "pyarrow>=17" "pydantic>=2.8" "pydantic-settings>=2.5" "rich>=13" >/dev/null 2>&1
  echo "serve deps download   $(mb $tmp/ws)"
  python -m pip download -q -d "$tmp/wp" "fastapi[standard]>=0.115" "uvicorn[standard]>=0.32" \
    "polars>=1.0" "pyarrow>=17" "pydantic>=2.8" "pydantic-settings>=2.5" "rich>=13" \
    "biopython>=1.83" "scipy>=1.13" "numpy>=1.26" "pybigtools>=0.3" >/dev/null 2>&1
  echo "pipeline deps download $(mb $tmp/wp)"
  rm -rf "$tmp"
} | tee "$OUT"
