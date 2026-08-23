#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

cd "$(dirname "$0")"

# Container name is the workspace folder basename (devcontainer.json's --name runArg).
CONTAINER="$(basename "$PWD")"

network_of() {
    local mode
    mode="$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$CONTAINER" 2>/dev/null)"
    [ "$mode" = "default" ] && mode=bridge
    echo "$mode"
}

attached() {
    [ -n "$(docker inspect -f '{{range $n, $_ := .NetworkSettings.Networks}}{{$n}} {{end}}' \
        "$CONTAINER" 2>/dev/null)" ]
}

wanted_ports() {
    docker inspect -f '{{range $p, $bs := .HostConfig.PortBindings}}{{range $bs}}{{.HostPort}}
{{end}}{{end}}' "$CONTAINER" 2>/dev/null | grep .
}

unbound_ports() {
    command -v ss >/dev/null 2>&1 || return 0
    local listening port
    listening="$(ss -ltn 2>/dev/null)"
    while read -r port; do
        grep -qE "[:.]${port}[[:space:]]" <<<"$listening" || echo "$port"
    done < <(wanted_ports)
}

# Fast path: if the container is already running, drop straight into a shell —
# skip `devcontainer up` and the post-create re-run.
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ]; then
    if ! attached; then
        echo "$CONTAINER is running with no network endpoint; reattaching to $(network_of)." >&2
        docker network connect "$(network_of)" "$CONTAINER" || true
    fi

    if ! attached; then
        echo "Could not reattach $CONTAINER to $(network_of). Recreate it with:" >&2
        echo "    docker rm -f $CONTAINER && $0" >&2
        exit 1
    fi

    missing="$(unbound_ports || true)"
    if [ -n "$missing" ]; then
        echo "$CONTAINER is attached but these published ports are not bound on the host:" >&2
        echo "    $(tr '\n' ' ' <<<"$missing")" >&2
        echo "Another container is probably holding them. Find it with \`docker ps -a\`," >&2
        echo "remove it, then recreate this one:" >&2
        echo "    docker rm -f $CONTAINER && $0" >&2
        exit 1
    fi

    exec devcontainer exec --workspace-folder . bash
fi

# First run (or the container is stopped): build/start, apply post-create, then enter.
# Discard the JSON result line on stdout; errors still surface via stderr + exit code.
devcontainer up --workspace-folder . >/dev/null

# Re-run the lifecycle hooks (post-create) against the existing container so edits
# to post-create.sh take effect without a rebuild. The script is idempotent.
devcontainer exec --workspace-folder . .devcontainer/post-create.sh

exec devcontainer exec --workspace-folder . bash
