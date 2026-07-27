# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from .config import settings
from .routers import genes, expression, conservation, clustering, meta, structure

app = FastAPI(title=settings.api_title, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
# binary-CIF coordinates compress about threefold
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(genes.router, prefix="/api")
app.include_router(expression.router, prefix="/api")
app.include_router(conservation.router, prefix="/api")
app.include_router(clustering.router, prefix="/api")
app.include_router(structure.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
