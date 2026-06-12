#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

VENV="/workspace/.venv"
BACKEND_REQ=/workspace/backend/requirements.txt
BACKEND_MARKER="$VENV/.backend-deps-installed"
FRONTEND_DIR=/workspace/frontend
FRONTEND_MARKER="$FRONTEND_DIR/node_modules/.install-marker"
ZELLIJ_VERSION="0.41.2"
ZELLIJ_BIN="$HOME/.local/bin/zellij"

# ── zellij ───────────────────────────────────────────────────────────────────
if [ ! -x "$ZELLIJ_BIN" ]; then
    echo "[entrypoint] installing zellij $ZELLIJ_VERSION"
    mkdir -p "$HOME/.local/bin"
    curl -fsSL "https://github.com/zellij-org/zellij/releases/download/v${ZELLIJ_VERSION}/zellij-x86_64-unknown-linux-musl.tar.gz" \
        | tar -xz -C "$HOME/.local/bin"
fi

# ── Python venv ──────────────────────────────────────────────────────────────
if [ ! -d "$VENV" ]; then
    echo "[entrypoint] creating Python venv at $VENV"
    python3 -m venv "$VENV"
fi

# ── Backend Python deps ──────────────────────────────────────────────────────
if [ -f "$BACKEND_REQ" ] && \
   { [ ! -f "$BACKEND_MARKER" ] || [ "$BACKEND_REQ" -nt "$BACKEND_MARKER" ]; }; then
    echo "[entrypoint] installing backend Python deps"
    "$VENV/bin/pip" install --upgrade pip wheel
    "$VENV/bin/pip" install -r "$BACKEND_REQ"
    touch "$BACKEND_MARKER"
fi

# ── Frontend npm deps ────────────────────────────────────────────────────────
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    mkdir -p "$FRONTEND_DIR/node_modules"
    sudo chown ubuntu:ubuntu "$FRONTEND_DIR/node_modules"
fi

if [ -f "$FRONTEND_DIR/package.json" ]; then
    if [ ! -f "$FRONTEND_MARKER" ] || [ "$FRONTEND_DIR/package.json" -nt "$FRONTEND_MARKER" ]; then
        echo "[entrypoint] installing frontend npm deps"
        npm install --prefix "$FRONTEND_DIR"
        touch "$FRONTEND_MARKER"
    fi
fi

# ── Shell config (interactive sessions) ─────────────────────────────────────
BASHRC="$HOME/.bashrc"
add_line() {
    grep -qF "$1" "$BASHRC" 2>/dev/null || echo "$1" >> "$BASHRC"
}
add_line 'export PATH="$HOME/.local/bin:$PATH"'
add_line "source $VENV/bin/activate"

exec "$@"
