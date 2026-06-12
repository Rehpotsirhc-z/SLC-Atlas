from functools import lru_cache
from .data.parquet_source import ParquetSource
from .config import settings


@lru_cache(maxsize=1)
def get_source() -> ParquetSource:
    return ParquetSource(settings.data_dir)
