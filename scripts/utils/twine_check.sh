#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Builds the package and runs twine. Pass --skip-web to reuse the existing
# web/dist instead of rebuilding the frontend.
#
# Usage:
#   scripts/utils/twine_check.sh
#   scripts/utils/twine_check.sh --skip-web

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

skip_web=0
for arg in "$@"; do
    case "$arg" in
    --skip-web) skip_web=1 ;;
    *)
        echo "unknown option: $arg" >&2
        exit 2
        ;;
    esac
done

if [ "$skip_web" -eq 0 ]; then
    npm --prefix web ci
    npm --prefix web run build
fi

python -m pip install --quiet --upgrade build twine

rm -rf dist
python -m build

echo "built version: $(ls dist/*.whl | sed -E 's|.*/atlasforge-(.*)-py3.*|\1|')"

python -m twine check dist/*
