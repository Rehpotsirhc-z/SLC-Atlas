#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Run inside the dev container (after ./enter-dev.sh).
# Launches Zellij: FastAPI on :8000, Vite on :3000.
# The venv is already on PATH via devcontainer.json's remoteEnv, so no activation.

zellij --layout zellij-layout.kdl
