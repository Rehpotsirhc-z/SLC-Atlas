# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from functools import lru_cache
from .config import settings
from .data.parquet_source import ParquetSource
from .data.source import DataSource


@lru_cache(maxsize=1)
def get_source() -> DataSource:
    return ParquetSource(settings.data_dir)
