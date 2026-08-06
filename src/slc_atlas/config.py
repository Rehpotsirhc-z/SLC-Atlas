# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).parent.parent.parent
_PACKAGED_WEB = Path(__file__).parent / "web"
# A wheel carries the built frontend, a source checkout has it under web/dist
_WEB_DIR = _PACKAGED_WEB if _PACKAGED_WEB.is_dir() else _REPO_ROOT / "web" / "dist"

PRODUCT_NAME = "SLC Atlas"
PRODUCT_VERSION = "0.1.0"


class Settings(BaseSettings):
    # Directory holding the Parquet files the app serves
    data_dir: Path = _REPO_ROOT / "data"
    # Directory holding the built frontend
    web_dir: Path = _WEB_DIR
    # Browser tab, link previews, and the web app manifest
    app_name: str = PRODUCT_NAME
    # App bar, where the full name does not fit
    app_short_name: str = PRODUCT_NAME
    # Subtitle on the Genes view and the page meta description
    app_description: str = ""
    # What one gene of this family is called, used in every view subtitle
    family_label: str = "gene"
    # Prefix on every downloaded figure, table, and tree
    download_prefix: str = "atlas"
    # Comma-separated origins allowed to call the API, empty to disable CORS
    cors_origins: str = "http://localhost:3000"
    # Address and port the server listens on
    host: str = "127.0.0.1"
    port: int = 8000

    # A .env beside the command overrides the repository's, and either may be absent
    model_config = SettingsConfigDict(
        env_prefix="ATLAS_", env_file=(_REPO_ROOT / ".env", ".env"), extra="ignore"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def api_title(self) -> str:
        return f"{self.app_name} API"


settings = Settings()


def refresh() -> Settings:
    """Re-read the environment into the shared settings object, in place."""
    fresh = Settings()
    for name in Settings.model_fields:
        object.__setattr__(settings, name, getattr(fresh, name))
    return settings
