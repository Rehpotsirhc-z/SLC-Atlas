# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from functools import lru_cache
from .data.parquet_source import ParquetSource
from .config import settings


@lru_cache(maxsize=1)
def get_source() -> ParquetSource:
    return ParquetSource(settings.data_dir)
