#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Runs on every container start (postStartCommand). Serves the built frontend
# (frontend/dist) on :80 and proxies /api/ to the backend on :8000. Idempotent:
# stops any running nginx before (re)starting. Run `npm --prefix frontend run build`
# to populate dist; nginx starts regardless and 404s until then.

set -e

# Playwright MCP's Chrome profile survives container restarts (~/.cache isn't
# wiped), but the Chrome process that held it doesn't. A container restart
# always kills Chrome uncleanly, leaving its Singleton* lock files behind and
# making the next MCP launch fail with "Browser is already in use". Since no
# Chrome process can legitimately be running this early in a container start,
# it's always safe to clear these here.
find /home/ubuntu/.cache/ms-playwright-mcp -maxdepth 2 -name 'Singleton*' -delete 2>/dev/null || true

NGINX_CONF=/workspace/.devcontainer/nginx.conf

if sudo nginx -t -c "$NGINX_CONF" >/dev/null 2>&1; then
    sudo nginx -s stop 2>/dev/null || true
    sudo nginx -c "$NGINX_CONF"
    echo "[post-start] nginx started on :80"
else
    echo "[post-start] WARNING: nginx config test failed — skipping start"
    sudo nginx -t -c "$NGINX_CONF" || true
fi
