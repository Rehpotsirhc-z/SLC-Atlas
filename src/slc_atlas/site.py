# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Serve the built frontend alongside the API, for `atlas serve`."""

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
        raise FileNotFoundError(f"no built frontend at {web_dir}; run `npm --prefix web run build`")
    return render(source.read_text())


def read_routes(web_dir: Path) -> set[str]:
    """Return the addresses the frontend answers itself, which the build writes down."""
    source = web_dir / ROUTES_FILE
    if not source.is_file():
        raise FileNotFoundError(f"no {ROUTES_FILE} at {web_dir}; run `npm --prefix web run build`")
    return {path.strip("/") for path in json.loads(source.read_text())}


def read_manifest(web_dir: Path) -> str | None:
    source = web_dir / "manifest.webmanifest"
    return render_manifest(source.read_text(encoding="utf-8")) if source.is_file() else None


class SpaFiles(StaticFiles):
    """Serve the static files, and serve the page itself for any path that has no file of
    its own.

    A view such as /structure is a route the frontend handles itself, so reloading the page
    while looking at one has to return the page rather than a 404. An address that is not
    one of those routes gets the same page with a 404 status, which is the not-found page
    the frontend draws for it.
    """

    def __init__(
        self, *, directory: Path, shell: str, manifest: str | None, routes: set[str]
    ) -> None:
        super().__init__(directory=directory)
        self.shell = shell
        self.manifest = manifest
        self.routes = routes

    async def get_response(self, path: str, scope: Scope) -> Response:
        # The copies on disk still hold the build-time names
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
    """Mount the frontend at /, which is done after the API routes so that they are matched
    first."""
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
