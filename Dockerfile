# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

FROM node:22-slim AS web
WORKDIR /build
# Copied before the sources so a code change does not reinstall dependencies
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build


FROM python:3.12-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/atlas
COPY pyproject.toml README.org hatch_build.py ./
COPY src/ ./src/
COPY --from=web /build/dist ./web/dist
ARG ATLASFORGE_VERSION=0.0.0
# Installs the command the entrypoint runs
RUN SETUPTOOLS_SCM_PRETEND_VERSION=${ATLASFORGE_VERSION} pip install --no-cache-dir .

COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV ATLASFORGE_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
