# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    data_dir: Path = _BACKEND_DIR / "data"

    model_config = SettingsConfigDict(env_prefix="SLC_", env_file=".env", extra="ignore")


settings = Settings()
