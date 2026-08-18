#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Stamps Apache-2.0 headers on all Python and TypeScript source files.
# Safe to rerun since REUSE does not duplicate existing headers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

reuse annotate \
    --copyright "Dong Lab, Yale School of Medicine <https://donglab.org>" \
    --license Apache-2.0 \
    --recursive \
    src/atlasforge/ \
    web/src/ \
    web/vite.config.ts
