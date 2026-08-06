# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi.responses import PlainTextResponse
from .config import settings


def newick_response(newick: str, name: str) -> PlainTextResponse:
    filename = f"{settings.download_prefix}_{name}.nwk"
    return PlainTextResponse(
        newick,
        media_type="text/x-nh",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
