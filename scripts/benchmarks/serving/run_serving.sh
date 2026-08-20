#!/usr/bin/env bash
# Compare atlasforge serve with an Nginx-hosted static export
set -u
REPO=/workspace
DATADIR=/workspace/.bench-build
SITE=/workspace/.bench-export
WEBDIR=/workspace/web/dist
OUT=$REPO/scripts/benchmarks/results/serving.jsonl
TTFB=$REPO/scripts/benchmarks/results/serving_ttfb.jsonl
COLD=$REPO/scripts/benchmarks/results/coldstart.jsonl
DYNAMIC_PORT=8100
STATIC_PORT=8101
: > "$OUT"
: > "$TTFB"

wait_ready () { # url, timeout_s -> echo seconds-to-first-200
  local url=$1 t=${2:-30} start now
  start=$(date +%s.%N)
  for _ in $(seq 1 $((t*10))); do
    if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      now=$(date +%s.%N); awk "BEGIN{printf \"%.3f\", $now-$start}"; return 0
    fi
    sleep 0.1
  done
  echo "TIMEOUT"; return 1
}

echo "== DYNAMIC: atlasforge serve on :$DYNAMIC_PORT (data-dir=$DATADIR)" >&2
ATLASFORGE_NO_PROGRESS=1 atlasforge serve --data-dir "$DATADIR" --web-dir "$WEBDIR" \
  --host 127.0.0.1 --port $DYNAMIC_PORT >/tmp/serve_dynamic.log 2>&1 &
DYNAMIC_PID=$!
cold_dynamic=$(wait_ready "http://127.0.0.1:$DYNAMIC_PORT/api/capabilities.json" 40)
echo "   cold-start (process->first 200): ${cold_dynamic}s" >&2
printf '{"mode":"dynamic","cold_start_seconds":"%s"}\n' "$cold_dynamic" >> "$COLD"
node "$REPO/scripts/benchmarks/serving/serve_bench.mjs" --base="http://127.0.0.1:$DYNAMIC_PORT" \
  --mode=dynamic --label="atlasforge serve" --out="$OUT" --connections=10 --duration=8 --warmup=3
bash "$REPO/scripts/benchmarks/serving/ttfb.sh" \
  --base="http://127.0.0.1:$DYNAMIC_PORT" --label=dynamic --out="$TTFB"
kill $DYNAMIC_PID 2>/dev/null; wait $DYNAMIC_PID 2>/dev/null

echo "== STATIC: nginx on :$STATIC_PORT (site=$SITE)" >&2
NGINX_CONF=/tmp/atlasforge-serving-nginx.conf
sed -e "s|listen      80;|listen      $STATIC_PORT;|" \
  -e "s|root        /srv/www;|root        $SITE;|" \
  -e "s|pid       /tmp/nginx.pid;|pid       /tmp/atlasforge-serving-nginx.pid;|" \
  -e "s|access_log   /dev/stdout;|access_log off;|" \
  "$REPO/deploy/nginx.conf" > "$NGINX_CONF"
nginx -c "$NGINX_CONF"
cold_static=$(wait_ready "http://127.0.0.1:$STATIC_PORT/api/capabilities.json" 40)
echo "   cold-start (process->first 200): ${cold_static}s" >&2
printf '{"mode":"static","cold_start_seconds":"%s"}\n' "$cold_static" >> "$COLD"
node "$REPO/scripts/benchmarks/serving/serve_bench.mjs" --base="http://127.0.0.1:$STATIC_PORT" \
  --mode=static --label="nginx" --out="$OUT" --connections=10 --duration=8 --warmup=3
bash "$REPO/scripts/benchmarks/serving/ttfb.sh" \
  --base="http://127.0.0.1:$STATIC_PORT" --label=nginx --out="$TTFB"
nginx -s stop -c "$NGINX_CONF"

echo "== serving benchmark done -> $OUT" >&2
