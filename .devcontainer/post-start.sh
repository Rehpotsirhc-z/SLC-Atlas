#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Runs on every container start (postStartCommand). Serves the built frontend
# (frontend/dist) on :80 and proxies /api/ to the backend on :8000. Idempotent:
# stops any running nginx before (re)starting. Run `npm --prefix frontend run build`
# to populate dist; nginx starts regardless and 404s until then.

set -e

NGINX_CONF=/workspace/.devcontainer/nginx.conf

if sudo nginx -t -c "$NGINX_CONF" >/dev/null 2>&1; then
    sudo nginx -s stop 2>/dev/null || true
    sudo nginx -c "$NGINX_CONF"
    echo "[post-start] nginx started on :80"
else
    echo "[post-start] WARNING: nginx config test failed — skipping start"
    sudo nginx -t -c "$NGINX_CONF" || true
fi
