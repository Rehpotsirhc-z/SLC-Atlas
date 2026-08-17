# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Write Parquet tables atomically and group gene-keyed rows for filtered reads."""

from pathlib import Path

import polars as pl

from . import interrupt


def write(frame: pl.DataFrame, path: Path, **options) -> None:
    """Write through a temporary sibling so no exit can leave a truncated table behind."""
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(f".{path.name}.partial")
    with interrupt.writing():
        try:
            frame.write_parquet(partial, **options)
            partial.replace(path)
        except BaseException:
            partial.unlink(missing_ok=True)
            raise


def write_gene_keyed(frame: pl.DataFrame, path: Path, *keys: str, row_group: int) -> None:
    """Sort by the given key columns, the first of which is the gene, and write in row groups
    of the given size."""
    write(frame.sort(*keys), path, row_group_size=row_group, statistics=True)
