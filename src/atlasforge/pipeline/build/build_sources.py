# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the provenance table used by the About panel."""

from pathlib import Path

import polars as pl

from ..lib import console, parquet

SOURCES_SCHEMA = {
    "domain": pl.Utf8,
    "source": pl.Utf8,
    "version": pl.Utf8,
    "assembly": pl.Utf8,
    "retrieved_date": pl.Utf8,
    "license_spdx": pl.Utf8,
    "url": pl.Utf8,
}


def run(source_dir: Path, out_dir: Path) -> None:
    path = source_dir / "sources.tsv"
    if not path.exists():
        return
    df = pl.read_csv(path, separator="\t", schema=SOURCES_SCHEMA)
    parquet.write(df, out_dir / "sources.parquet")
    console.success(f"Wrote {df.height} data sources -> {out_dir / 'sources.parquet'}")
