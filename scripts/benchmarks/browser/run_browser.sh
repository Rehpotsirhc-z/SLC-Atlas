#!/usr/bin/env bash
# Measure byte-range requests for one coverage track in each browser
set -u
REPO=/workspace
D=$REPO/scripts/benchmarks/browser
EXPORT=/workspace/.bench-export
OUT=$REPO/scripts/benchmarks/results/browser.jsonl
REPS=${REPS:-5}
JBFULL=$(cat "$EXPORT/jb_tracks_full.txt")
TRACK=atac_astrocytes.bw
: > "$OUT"

LOCI=(
  "50kb|SLC6A9|chr1:43985559-44035559"
  "1Mb|SLC6A9|chr1:43510559-44510559"
  "10Mb|SLC6A9|chr1:39010559-49010559"
  "50Mb|SLC6A9|chr1:19010559-69010559"
  "chr1_249Mb|SLC6A9|chr1:1-248956422"
)

run () { # tool label bucket locus url extra_flags...
  local tool=$1 label=$2 bucket=$3 locus=$4 url=$5; shift 5
  node "$D/drive.mjs" --tool="$tool" --label="$label" --bucket="$bucket" --locus="$locus" \
    --url="$url" --match="$TRACK" --reps="$REPS" --out="$OUT" "$@"
}

for entry in "${LOCI[@]}"; do
  IFS='|' read -r bucket symbol locus <<< "$entry"
  echo "== locus $bucket $symbol $locus" >&2
  run igv "igv.js" "$bucket" "$locus" \
    "http://127.0.0.1:8080/igv_full.html?loc=$locus&set=full" \
    --settle=3000 --min-observe=4000 --timeout=60000
  run jbrowse "JBrowse 2" "$bucket" "$locus" \
    "http://127.0.0.1:8080/jbrowse-web/?config=/config_full.json&assembly=hg38&loc=$locus&tracks=$JBFULL" \
    --settle=3000 --min-observe=5000 --timeout=60000
  run atlasforge "AtlasForge" "$bucket" "$locus" \
    "http://127.0.0.1:8080/browser/?gene=$symbol&loc=$locus" \
    --settle=3000 --min-observe=6000 --timeout=60000
done
echo "== browser matrix done -> $OUT" >&2
