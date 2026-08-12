#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

set -e

find /home/ubuntu/.cache/ms-playwright-mcp -maxdepth 2 -name 'Singleton*' -delete 2>/dev/null || true
