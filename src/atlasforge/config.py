# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).parent.parent.parent
_PACKAGED_WEB = Path(__file__).parent / "web"
_WEB_DIR = _PACKAGED_WEB if _PACKAGED_WEB.is_dir() else _REPO_ROOT / "web" / "dist"
_DATA_DIR = _REPO_ROOT / "data" if (_REPO_ROOT / "pyproject.toml").is_file() else Path("data")

PRODUCT_NAME = "AtlasForge"
PRODUCT_VERSION = "0.1.0"
COMMAND_NAME = "atlasforge"
DISTRIBUTION_NAME = __name__.rpartition(".")[0].replace("_", "-")


class Settings(BaseSettings):
    data_dir: Path = Field(
        default=_DATA_DIR,
        description="dataset directory containing curation/, source/, cache/, and app/",
    )
    web_dir: Path = Field(
        default=_WEB_DIR,
        description="built frontend to serve",
    )
    app_name: str = Field(
        default=PRODUCT_NAME,
        description="full name used in the browser tab, link previews, and app manifest",
    )
    app_short_name: str = Field(default=PRODUCT_NAME, description="short name used in the app bar")
    app_description: str = Field(
        default="",
        description="description shown on the Genes view and in page metadata",
    )
    family_label: str = Field(
        default="gene",
        description="singular name for one member of the gene family",
    )
    download_prefix: str = Field(
        default="atlasforge",
        description="prefix for downloaded figures, tables, and trees",
    )
    cors_origins: str = Field(
        default="http://localhost:3000",
        description="comma-separated origins allowed to call the API; empty disables CORS",
    )
    host: str = Field(default="127.0.0.1", description="address the local server listens on")
    port: int = Field(default=8000, description="port the local server listens on")

    model_config = SettingsConfigDict(
        env_prefix="ATLASFORGE_", env_file=(_REPO_ROOT / ".env", ".env"), extra="ignore"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def api_title(self) -> str:
        return f"{self.app_name} API"

    @property
    def app_dir(self) -> Path:
        return self.data_dir / "app"


settings = Settings()


def refresh() -> Settings:
    """Reload shared settings from the environment"""
    fresh = Settings()
    for name in Settings.model_fields:
        object.__setattr__(settings, name, getattr(fresh, name))
    return settings
