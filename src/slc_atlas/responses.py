# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from email.utils import parsedate
from pathlib import Path

from fastapi import Request, Response
from fastapi.responses import FileResponse, PlainTextResponse
from starlette.staticfiles import NotModifiedResponse

from .config import settings

BINARY = "application/octet-stream"


def _unchanged(request: Request, response: FileResponse) -> bool:
    """Whether the copy the client already holds is still the file on disk."""
    tags = request.headers.get("if-none-match")
    if tags:
        return response.headers["etag"] in [
            tag.strip().removeprefix("W/") for tag in tags.split(",")
        ]
    since = parsedate(request.headers.get("if-modified-since", ""))
    modified = parsedate(response.headers["last-modified"])
    return since is not None and modified is not None and since >= modified


def byte_range_file(path: Path, request: Request) -> Response:
    """Serve a byte-range file and require cached copies to be revalidated."""
    response = FileResponse(
        path,
        media_type=BINARY,
        stat_result=path.stat(),
        headers={"Cache-Control": "no-cache"},
    )
    return NotModifiedResponse(response.headers) if _unchanged(request, response) else response


def newick_response(newick: str, name: str) -> PlainTextResponse:
    filename = f"{settings.download_prefix}_{name}.nwk"
    return PlainTextResponse(
        newick,
        media_type="text/x-nh",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
