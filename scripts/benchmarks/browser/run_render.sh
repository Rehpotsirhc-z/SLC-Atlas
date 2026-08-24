#!/usr/bin/env bash
# Measure cold and warm rendering of the same tracks and spans in each browser
set -u
D=/workspace/scripts/benchmarks/browser
EXPORT=/workspace/.bench-export
OUT=/workspace/scripts/benchmarks/results/browser_render_full.jsonl
REPS=${REPS:-3}
JBFULL=$(cat "$EXPORT/jb_tracks_full.txt")
: > "$OUT"
LOCI=(
  "50kb|SLC6A9|chr1:43985559-44035559"
  "1Mb|SLC6A9|chr1:43510559-44510559"
  "10Mb|SLC6A9|chr1:39010559-49010559"
  "50Mb|SLC6A9|chr1:19010559-69010559"
  "chr1_249Mb|SLC6A9|chr1:1-248956422"
)
H_IGV=1860; H_JB=3980; H_AF=2280
r () { node "$D/render.mjs" --reps="$REPS" --stable=1200 --min=2000 --timeout=90000 --out="$OUT" "$@"; }
for entry in "${LOCI[@]}"; do
  IFS='|' read -r bucket symbol locus <<< "$entry"
  echo "== $bucket $locus" >&2
  r --tool=igv --label='igv.js' --height="$H_IGV" --bucket="$bucket" --locus="$locus" \
    --url="http://127.0.0.1:8080/igv_full.html?loc=$locus&set=full"
  r --tool=jbrowse --label='JBrowse 2' --height="$H_JB" --bucket="$bucket" --locus="$locus" \
    --url="http://127.0.0.1:8080/jbrowse-web/?config=/config_full.json&assembly=hg38&loc=$locus&tracks=$JBFULL"
  r --tool=atlasforge_nginx --label='AtlasForge (nginx)' --height="$H_AF" --bucket="$bucket" --locus="$locus" \
    --url="http://127.0.0.1:8080/browser/?gene=$symbol&loc=$locus"
  r --tool=atlasforge_serve --label='AtlasForge (atlas serve)' --height="$H_AF" --bucket="$bucket" --locus="$locus" \
    --url="http://127.0.0.1:8100/browser?gene=$symbol&loc=$locus"
done
echo "== render matrix done -> $OUT" >&2
