# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Typed conversion of dataset/genes.tsv and transcripts.tsv into the served Parquet."""

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.dataset_schema import GENE_SCHEMA, TRANSCRIPT_SCHEMA

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DEFAULT_GENES_IN = DATA_DIR / "dataset" / "genes.tsv"
DEFAULT_TRANSCRIPTS_IN = DATA_DIR / "dataset" / "transcripts.tsv"
DEFAULT_GENES_OUT = DATA_DIR / "genes.parquet"
DEFAULT_TRANSCRIPTS_OUT = DATA_DIR / "transcripts.parquet"


def convert(in_path: Path, out_path: Path, schema: dict) -> int:
    df = pl.read_csv(in_path, separator="\t", schema=schema)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out_path)
    return df.height


def main() -> None:
    args = sys.argv[1:]
    genes_in = Path(args[0]) if len(args) > 0 else DEFAULT_GENES_IN
    transcripts_in = Path(args[1]) if len(args) > 1 else DEFAULT_TRANSCRIPTS_IN
    genes_out = Path(args[2]) if len(args) > 2 else DEFAULT_GENES_OUT
    transcripts_out = Path(args[3]) if len(args) > 3 else DEFAULT_TRANSCRIPTS_OUT

    n_genes = convert(genes_in, genes_out, GENE_SCHEMA)
    n_transcripts = convert(transcripts_in, transcripts_out, TRANSCRIPT_SCHEMA)
    print(f"wrote {n_genes} genes -> {genes_out}", file=sys.stderr)
    print(f"wrote {n_transcripts} transcripts -> {transcripts_out}", file=sys.stderr)


if __name__ == "__main__":
    main()
