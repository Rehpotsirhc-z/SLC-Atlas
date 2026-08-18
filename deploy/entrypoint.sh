#!/bin/sh
# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

# Builds the site from the mounted dataset, then hands the container over to nginx

set -eu

SITE_DIR="${ATLASFORGE_SITE_DIR:-/srv/www}"
DATA_DIR="${ATLASFORGE_DATA_DIR:-/data}"

# Only the build outputs under app/ are served, the rest of the dataset is pipeline input
if [ ! -d "$DATA_DIR/app" ]; then
    echo "No built dataset at $DATA_DIR/app. Mount one with -v /your/data:$DATA_DIR" >&2
    exit 1
fi

# Reads the ATLASFORGE_ variables, so a rename needs a restart and not a rebuild
echo "Building site in $SITE_DIR"
atlasforge export "$SITE_DIR"

# Replaces this script as PID 1 so Docker can stop the container cleanly
exec nginx -g 'daemon off;'
