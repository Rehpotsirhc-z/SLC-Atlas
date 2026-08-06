# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Put a deployment's names into a built index.html.

`vite build` leaves `__ATLAS_*__` placeholders in the page. Filling them here rather than
at build time is what lets one build be renamed, and puts the name in the markup itself
where search engines and link previews can read it without running JavaScript.

The atlas-shell plugin in web/vite.config.ts does the same during development.
"""

import html
import json
from .config import settings


def atlas_config() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "shortName": settings.app_short_name,
        "description": settings.app_description,
        "familyLabel": settings.family_label,
        "downloadPrefix": settings.download_prefix,
    }


def render(template: str, config: dict[str, str] | None = None) -> str:
    config = atlas_config() if config is None else config
    island = json.dumps(config, separators=(",", ":")).replace("<", "\\u003c")
    return (
        template.replace("__ATLAS_APP_NAME__", html.escape(config["name"]))
        .replace("__ATLAS_APP_DESCRIPTION__", html.escape(config["description"]))
        .replace("__ATLAS_CONFIG_JSON__", island)
    )
