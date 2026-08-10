# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Apply deployment names to a built frontend without rebuilding it"""

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


def render_manifest(template: str) -> str:
    try:
        manifest = json.loads(template)
    except ValueError:
        return template
    if not isinstance(manifest, dict):
        return template
    manifest["name"] = settings.app_name
    manifest["short_name"] = settings.app_short_name
    if settings.app_description:
        manifest["description"] = settings.app_description
    else:
        manifest.pop("description", None)
    return json.dumps(manifest, separators=(",", ":"))
