#!/usr/bin/env bash
# Export AtlasForge and start the Nginx and atlasforge serve benchmark servers
set -eu
REPO=/workspace
EXPORT=${EXPORT:-/workspace/.bench-export}
SITE=$REPO/scripts/benchmarks/browser/site

echo "[setup] export AtlasForge static site -> $EXPORT" >&2
rm -rf "$EXPORT"
ATLASFORGE_NO_PROGRESS=1 atlasforge export "$EXPORT" --data-dir "$REPO/data" --web-dir "$REPO/web/dist" >/dev/null

echo "[setup] copy igv/JBrowse harness into the export root" >&2
cp "$SITE/igv_full.html" "$SITE/hg38.min.fa" "$SITE/hg38.min.fa.fai" "$EXPORT/"
# Keep igv.js genome-registry requests local
cp "$SITE/url_mappings.tsv" "$SITE/genomes_empty.json" "$EXPORT/"
cp "$REPO/scripts/benchmarks/node_modules/igv/dist/igv.min.js" "$EXPORT/"
ln -sfn "$REPO/scripts/benchmarks/browser/jbrowse-web" "$EXPORT/jbrowse-web"

echo "[setup] build portable gene-model and GWAS tracks for igv.js and JBrowse 2" >&2
EXPORT="$EXPORT" python "$REPO/scripts/benchmarks/browser/build_bench_tracks.py" >&2

echo "[setup] generate full-track configs pointing at the export's /api/browser data" >&2
EXPORT="$EXPORT" python "$REPO/scripts/benchmarks/browser/gen_nginx_configs.py"

echo "[setup] start nginx :8080" >&2
mkdir -p /tmp/nginx-bench/body
cat > /tmp/nginx-bench.conf <<EOF
worker_processes auto;
error_log /tmp/nginx-bench-error.log warn;
pid /tmp/nginx-bench.pid;
events { worker_connections 1024; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  client_body_temp_path /tmp/nginx-bench/body;
  proxy_temp_path /tmp/nginx-bench/proxy;
  fastcgi_temp_path /tmp/nginx-bench/fastcgi;
  uwsgi_temp_path /tmp/nginx-bench/uwsgi;
  scgi_temp_path /tmp/nginx-bench/scgi;
  sendfile on; tcp_nopush on; max_ranges 100;
  gzip on; gzip_min_length 1024;
  gzip_types application/json text/plain text/css application/javascript image/svg+xml;
  gzip_static on;
  server {
    listen 0.0.0.0:8080; server_name _; root $EXPORT; autoindex off;
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location /api/ { add_header Cache-Control "no-cache"; try_files \$uri =404; }
    location /api/structure/models/ { add_header Cache-Control "no-cache"; }
    location /api/browser/coverage/ { add_header Cache-Control "no-cache"; gzip off; gzip_static off; }
    location = /api/browser/models.bb { add_header Cache-Control "no-cache"; gzip off; gzip_static off; }
    location /api/browser/gwas/ { add_header Cache-Control "no-cache"; gzip off; gzip_static off; }
    location = /models_std.bb { add_header Cache-Control "no-cache"; gzip off; gzip_static off; }
    location = /gwas_manhattan.bw { add_header Cache-Control "no-cache"; gzip off; gzip_static off; }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location / { error_page 404 /404.html; try_files \$uri \$uri/index.html =404; }
  }
}
EOF
[ -f /tmp/nginx-bench.pid ] && nginx -s stop -c /tmp/nginx-bench.conf 2>/dev/null || true
nginx -c /tmp/nginx-bench.conf

echo "[setup] start atlasforge serve :8100 (FastAPI mode)" >&2
ATLASFORGE_NO_PROGRESS=1 atlasforge serve --data-dir "$REPO/data" --web-dir "$REPO/web/dist" \
  --host 127.0.0.1 --port 8100 >/tmp/serve8100.log 2>&1 &

sleep 2
echo "[setup] nginx :8080 -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/browser/)  serve :8100 -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/api/capabilities.json)" >&2
