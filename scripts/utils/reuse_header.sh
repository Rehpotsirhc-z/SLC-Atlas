#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Usage: scripts/utils/reuse_header.sh [--license LICENSE] <file> [file ...]
#
# Adds an Apache-2.0 SPDX header to source files. Pass --license CC0-1.0
# to use CC0 instead (e.g. for config/boilerplate files).
#
# Examples:
#   scripts/utils/reuse_header.sh src/atlasforge/routers/new_router.py
#   scripts/utils/reuse_header.sh --license CC0-1.0 some-config-file.yml

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

LICENSE="Apache-2.0"

if [[ "$1" == "--license" ]]; then
    LICENSE="$2"
    shift 2
fi

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [--license LICENSE] <file> [file ...]" >&2
    exit 1
fi

reuse annotate \
    --copyright "Dong Lab, Yale School of Medicine <https://donglab.org>" \
    --license "$LICENSE" \
    "$@"
