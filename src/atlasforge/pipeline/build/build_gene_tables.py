# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Convert source/genes.tsv and source/transcripts.tsv into the Parquet files the app
serves, giving every column the type it should have.
"""

from pathlib import Path

import polars as pl

from ..lib import parquet
from ..lib import console

from ..lib.source_schema import GENE_SCHEMA, TRANSCRIPT_SCHEMA


def convert(in_path: Path, out_path: Path, schema: dict) -> int:
    df = pl.read_csv(in_path, separator="\t", schema=schema)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    parquet.write(df, out_path)
    return df.height


def run(source_dir: Path, out_dir: Path) -> None:
    genes_out = out_dir / "genes.parquet"
    transcripts_out = out_dir / "transcripts.parquet"

    n_genes = convert(source_dir / "genes.tsv", genes_out, GENE_SCHEMA)
    n_transcripts = convert(source_dir / "transcripts.tsv", transcripts_out, TRANSCRIPT_SCHEMA)
    console.success(f"Wrote {n_genes} genes -> {genes_out}")
    console.success(f"Wrote {n_transcripts} transcripts -> {transcripts_out}")
