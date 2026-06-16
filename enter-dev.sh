#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

if ! docker compose ps --status running | grep -q slc-atlas; then
    echo "Container not running. Starting it..."
    docker compose up -d --build
fi

docker compose exec dev bash
