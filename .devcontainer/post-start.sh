#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

find /home/ubuntu/.cache/ms-playwright-mcp -maxdepth 2 -name 'Singleton*' -delete 2>/dev/null || true

NGINX_CONF=/workspace/deploy/nginx.conf
SITE=/srv/www
ATLAS=/workspace/.venv/bin/atlas

sudo mkdir -p "$SITE"
sudo chown "$(id -u):$(id -g)" "$SITE"
sudo ln -sfn /workspace/data /data

if [ ! -x "$ATLAS" ]; then
    echo "[post-start] no atlas command yet, run .devcontainer/post-create.sh"
elif [ ! -d /workspace/web/dist ]; then
    echo "[post-start] frontend not built, run: npm --prefix web run build"
elif ! "$ATLAS" export "$SITE"; then
    echo "[post-start] WARNING: export failed, :80 will serve whatever was there before"
fi

if sudo nginx -t -c "$NGINX_CONF" >/dev/null 2>&1; then
    # -s stop, not quit: quit drains open keepalive connections and can block for minutes.
    # -c matters here too, since nginx reads the pid path out of the config it is given
    sudo nginx -s stop -c "$NGINX_CONF" 2>/dev/null || sudo pkill -x nginx 2>/dev/null || true
    for _ in $(seq 40); do
        ss -ltn 2>/dev/null | grep -qE ':80\s' || break
        sleep 0.25
    done
    sudo nginx -c "$NGINX_CONF"
    echo "[post-start] nginx started on :80 from $NGINX_CONF"
else
    echo "[post-start] WARNING: nginx config test failed — skipping start"
    sudo nginx -t -c "$NGINX_CONF" || true
fi
