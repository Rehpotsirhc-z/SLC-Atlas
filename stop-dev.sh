#!/usr/bin/env bash

# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: CC0-1.0

# Stop the dev container so it can be resumed quickly with ./enter-dev.sh.
#
# Default (like `docker compose stop`): only stops the container, preserving its filesystem
#
#   --down        also remove the container (like `docker compose down`); the next
#                 start rebuilds it from the image and re-runs create-time setup
#   -v|--volumes  imply --down and also delete the dependency volumes, forcing a
#                 full reinstall of Python/Node deps on next start
#

set -e

cd "$(dirname "$0")"

CONTAINER="$(basename "$PWD")"

remove=0
volumes=0
for arg in "$@"; do
    case "$arg" in
    --down) remove=1 ;;
    -v | --volumes)
        remove=1
        volumes=1
        ;;
    *)
        echo "[stop-dev] unknown option: $arg" >&2
        exit 2
        ;;
    esac
done

if [ "$remove" = 1 ]; then
    if docker rm -f "$CONTAINER" >/dev/null 2>&1; then
        echo "[stop-dev] removed container $CONTAINER"
    else
        echo "[stop-dev] no container named $CONTAINER"
    fi
else
    if docker stop "$CONTAINER" >/dev/null 2>&1; then
        echo "[stop-dev] stopped container $CONTAINER (resume with ./enter-dev.sh)"
    else
        echo "[stop-dev] no running container named $CONTAINER"
    fi
fi

if [ "$volumes" = 1 ]; then
    if docker volume rm "${CONTAINER}-venv" "${CONTAINER}-node-modules" >/dev/null 2>&1; then
        echo "[stop-dev] removed dependency volumes"
    else
        echo "[stop-dev] no dependency volumes to remove"
    fi
fi
