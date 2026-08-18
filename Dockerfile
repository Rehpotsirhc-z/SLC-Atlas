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
COPY pyproject.toml README.org ./
COPY src/ ./src/
COPY --from=web /build/dist ./web/dist
# Installs the command the entrypoint runs
RUN pip install --no-cache-dir .

COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV ATLASFORGE_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
