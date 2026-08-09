# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).parent.parent.parent
_PACKAGED_WEB = Path(__file__).parent / "web"
# An installed package carries the built frontend, and a checkout has it under web/dist
_WEB_DIR = _PACKAGED_WEB if _PACKAGED_WEB.is_dir() else _REPO_ROOT / "web" / "dist"
_DATA_DIR = _REPO_ROOT / "data" if (_REPO_ROOT / "pyproject.toml").is_file() else Path("data")

PRODUCT_NAME = "SLC Atlas"
PRODUCT_VERSION = "0.1.0"
COMMAND_NAME = "atlas"
DISTRIBUTION_NAME = __name__.rpartition(".")[0].replace("_", "-")


class Settings(BaseSettings):
    data_dir: Path = Field(
        default=_DATA_DIR,
        description="the dataset directory, holding curation/, source/, cache/ and app/",
    )
    web_dir: Path = Field(
        default=_WEB_DIR,
        description="the built frontend to serve, which an installed package carries",
    )
    app_name: str = Field(
        default=PRODUCT_NAME,
        description="the name in the browser tab, link previews, and the manifest",
    )
    app_short_name: str = Field(
        default=PRODUCT_NAME, description="the name in the app bar, where the full one does not fit"
    )
    app_description: str = Field(
        default="",
        description="one line under the heading on the Genes view, and the page description",
    )
    family_label: str = Field(
        default="gene",
        description="what one member of this family is called, used in every subtitle",
    )
    download_prefix: str = Field(
        default="atlas",
        description="the first word of every downloaded figure, table, and tree filename",
    )
    cors_origins: str = Field(
        default="http://localhost:3000",
        description="origins allowed to call the API, comma-separated, empty to disable CORS",
    )
    host: str = Field(default="127.0.0.1", description="the address the server listens on")
    port: int = Field(default=8000, description="the port the server listens on")

    # A .env in the working directory overrides the repository's, and both are optional
    model_config = SettingsConfigDict(
        env_prefix="ATLAS_", env_file=(_REPO_ROOT / ".env", ".env"), extra="ignore"
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
    """Read the environment again and update the shared settings object with what it
    says."""
    fresh = Settings()
    for name in Settings.model_fields:
        object.__setattr__(settings, name, getattr(fresh, name))
    return settings
