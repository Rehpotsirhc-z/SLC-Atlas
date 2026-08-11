# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Gzip middleware that preserves byte offsets for range requests."""

from fastapi.middleware.gzip import GZipMiddleware
from starlette.datastructures import Headers
from starlette.types import Receive, Scope, Send


class RangeAwareGZipMiddleware(GZipMiddleware):
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and Headers(scope=scope).get("range"):
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)
