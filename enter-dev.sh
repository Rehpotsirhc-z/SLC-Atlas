#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

cd "$(dirname "$0")"

# Container name is the workspace folder basename (devcontainer.json's --name runArg).
CONTAINER="$(basename "$PWD")"

# Fast path: if the container is already running, drop straight into a shell —
# skip `devcontainer up` and the post-create re-run.
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" = "true" ]; then
    exec devcontainer exec --workspace-folder . bash
fi

# First run (or the container is stopped): build/start, apply post-create, then enter.
# Discard the JSON result line on stdout; errors still surface via stderr + exit code.
devcontainer up --workspace-folder . >/dev/null

# Re-run the lifecycle hooks (post-create) against the existing container so edits
# to post-create.sh take effect without a rebuild. The script is idempotent.
devcontainer exec --workspace-folder . .devcontainer/post-create.sh

exec devcontainer exec --workspace-folder . bash
