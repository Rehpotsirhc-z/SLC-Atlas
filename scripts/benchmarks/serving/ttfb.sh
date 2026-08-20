#!/usr/bin/env bash
# Measure median time to first byte for each serving endpoint
set -eu

BASE=
LABEL=
OUT=
REPS=21

for argument in "$@"; do
  case "$argument" in
    --base=*) BASE=${argument#*=} ;;
    --label=*) LABEL=${argument#*=} ;;
    --out=*) OUT=${argument#*=} ;;
    --reps=*) REPS=${argument#*=} ;;
    *)
      echo "Unknown argument: $argument" >&2
      exit 2
      ;;
  esac
done

if [ -z "$BASE" ] || [ -z "$LABEL" ] || [ -z "$OUT" ]; then
  echo "Usage: ttfb.sh --base=URL --label=NAME --out=PATH [--reps=N]" >&2
  exit 2
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ENDPOINTS="$SCRIPT_DIR/endpoints.json"
mkdir -p "$(dirname "$OUT")"

python3 -c '
import json
import sys

for endpoint in json.load(open(sys.argv[1]))["endpoints"]:
    print(endpoint["key"], endpoint["path"], sep="\t")
' "$ENDPOINTS" |
  while IFS=$'\t' read -r key path; do
    times=()
    for _ in $(seq 1 "$REPS"); do
      times+=("$(curl -fsS -o /dev/null -w '%{time_starttransfer}' "$BASE$path")")
    done
    median=$(
      printf '%s\n' "${times[@]}" |
        sort -n |
        awk '{values[NR]=$1} END{printf "%.3f", values[int((NR+1)/2)]*1000}'
    )
    printf '{"mode":"%s","key":"%s","path":"%s","ttfb_ms":%s}\n' \
      "$LABEL" "$key" "$path" "$median" >> "$OUT"
    echo "[$LABEL] $key: $median ms" >&2
  done
