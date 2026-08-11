# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import PRODUCT_VERSION, settings
from .middleware import RangeAwareGZipMiddleware
from .routers import browser, genes, expression, conservation, clustering, meta, structure

app = FastAPI(title=settings.api_title, version=PRODUCT_VERSION)

# Only needed when the frontend is served from a different origin than the API
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
# Binary-CIF coordinates compress about threefold
app.add_middleware(RangeAwareGZipMiddleware, minimum_size=1024)

app.include_router(genes.router, prefix="/api")
app.include_router(expression.router, prefix="/api")
app.include_router(conservation.router, prefix="/api")
app.include_router(clustering.router, prefix="/api")
app.include_router(structure.router, prefix="/api")
app.include_router(browser.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
