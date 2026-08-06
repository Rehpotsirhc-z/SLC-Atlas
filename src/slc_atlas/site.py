# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Serve the built frontend alongside the API, for `atlas serve`."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from .shell import render


def read_shell(web_dir: Path) -> str:
    template = web_dir / "index.html.template"
    source = template if template.is_file() else web_dir / "index.html"
    if not source.is_file():
        raise FileNotFoundError(f"no built frontend at {web_dir}, run `npm --prefix web run build`")
    return render(source.read_text())


class SpaFiles(StaticFiles):
    """Static files that serve index.html for any path with no file behind it.

    Views like /structure are client-side routes, so a reload on one must still get the
    page rather than a 404.
    """

    def __init__(self, *, directory: Path, shell: str) -> None:
        super().__init__(directory=directory)
        self.shell = shell

    async def get_response(self, path: str, scope: Scope) -> Response:
        # The copy on disk still holds unfilled __ATLAS_*__ placeholders
        if path in ("", ".", "index.html"):
            return HTMLResponse(self.shell)
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code == 404:
                return HTMLResponse(self.shell)
            raise


def mount_site(app: FastAPI, web_dir: Path) -> None:
    """Mount the frontend at /, after the API routes so they are matched first."""
    app.mount("/", SpaFiles(directory=web_dir, shell=read_shell(web_dir)), name="site")
