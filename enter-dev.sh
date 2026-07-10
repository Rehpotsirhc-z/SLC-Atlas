#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

cd "$(dirname "$0")"

# Idempotent: builds + starts on first run, reuses the container afterwards.
# Discard the JSON result line on stdout; errors still surface via stderr + exit code.
devcontainer up --workspace-folder . >/dev/null

# Re-run the lifecycle hooks (post-create) against the existing container so edits
# to post-create.sh take effect without a rebuild. The script is idempotent.
devcontainer exec --workspace-folder . .devcontainer/post-create.sh

devcontainer exec --workspace-folder . bash
