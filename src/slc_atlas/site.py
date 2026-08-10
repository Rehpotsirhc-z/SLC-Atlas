# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Serve a built atlas alongside its API"""

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from .shell import render, render_manifest

ROUTES_FILE = "routes.json"


def read_shell(web_dir: Path) -> str:
    template = web_dir / "index.html.template"
    source = template if template.is_file() else web_dir / "index.html"
    if not source.is_file():
        raise FileNotFoundError(
            f"No built frontend was found at {web_dir}. Run `npm --prefix web run build`."
        )
    return render(source.read_text())


def read_routes(web_dir: Path) -> set[str]:
    """Return the page routes recorded by the frontend build"""
    source = web_dir / ROUTES_FILE
    if not source.is_file():
        raise FileNotFoundError(
            f"No {ROUTES_FILE} was found at {web_dir}. Run `npm --prefix web run build`."
        )
    return {path.strip("/") for path in json.loads(source.read_text())}


def read_manifest(web_dir: Path) -> str | None:
    source = web_dir / "manifest.webmanifest"
    return render_manifest(source.read_text(encoding="utf-8")) if source.is_file() else None


class SpaFiles(StaticFiles):
    """Serve static assets and the app shell for frontend routes"""

    def __init__(
        self, *, directory: Path, shell: str, manifest: str | None, routes: set[str]
    ) -> None:
        super().__init__(directory=directory)
        self.shell = shell
        self.manifest = manifest
        self.routes = routes

    async def get_response(self, path: str, scope: Scope) -> Response:
        # Render deployment names without changing the built files
        if path in ("", ".", "index.html"):
            return HTMLResponse(self.shell)
        if path == "manifest.webmanifest" and self.manifest is not None:
            return Response(self.manifest, media_type="application/manifest+json")
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return HTMLResponse(self.shell, status_code=200 if path in self.routes else 404)
            raise


def mount_site(app: FastAPI, web_dir: Path) -> None:
    """Mount the frontend after the API routes"""
    app.mount(
        "/",
        SpaFiles(
            directory=web_dir,
            shell=read_shell(web_dir),
            manifest=read_manifest(web_dir),
            routes=read_routes(web_dir),
        ),
        name="site",
    )
