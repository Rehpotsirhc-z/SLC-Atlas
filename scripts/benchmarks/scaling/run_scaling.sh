#!/usr/bin/env bash
# Measure build time, response size, and latency across several gene counts
set -u
REPO=/workspace
TIMEIT=$REPO/scripts/benchmarks/lib/timeit.sh
OUT_BUILD=$REPO/scripts/benchmarks/results/scaling_build.jsonl
OUT_SIZE=$REPO/scripts/benchmarks/results/scaling_size.jsonl
PORT=8102
: > "$OUT_BUILD"; : > "$OUT_SIZE"
NS=(${NS:-25 100 250 462})

for N in "${NS[@]}"; do
  DEST=/workspace/.bench-scale-$N
  rm -rf "$DEST"
  python "$REPO/scripts/benchmarks/scaling/make_subset.py" "$N" "$DEST"
  ATLASFORGE_NO_PROGRESS=1 bash "$TIMEIT" "scaling_build:N=$N" "$OUT_BUILD" -- \
    atlasforge build --data-dir "$DEST" --step gene_tables --step expression --step conservation
  ATLASFORGE_NO_PROGRESS=1 atlasforge serve --data-dir "$DEST" --web-dir "$REPO/web/dist" \
    --host 127.0.0.1 --port $PORT >/tmp/serve_scale.log 2>&1 &
  SPID=$!
  for _ in $(seq 1 40); do curl -fsS -o /dev/null http://127.0.0.1:$PORT/api/capabilities.json 2>/dev/null && break; sleep 0.2; done
  for ep in genes.json conservation.json expression/all.json; do
    url="http://127.0.0.1:$PORT/api/$ep"
    size=$(curl -s -H 'accept-encoding: identity' -o /dev/null -w '%{size_download}' "$url")
    times=()
    for _ in $(seq 1 7); do
      t=$(curl -s -H 'accept-encoding: identity' -o /dev/null -w '%{time_total}' "$url"); times+=("$t")
    done
    median=$(printf '%s\n' "${times[@]}" | sort -n | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}')
    printf '{"N":%d,"endpoint":"%s","identity_bytes":%s,"median_time_s":%s}\n' "$N" "$ep" "$size" "$median" >> "$OUT_SIZE"
    echo "  N=$N $ep size=${size}B median=${median}s" >&2
  done
  kill $SPID 2>/dev/null; wait $SPID 2>/dev/null
done
echo "== scaling done" >&2
