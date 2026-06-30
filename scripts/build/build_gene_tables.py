# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Convert dataset/genes.tsv and transcripts.tsv into the served genes.parquet and
transcripts.parquet (typed conversion)."""

import sys
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
DEFAULT_GENES_IN = DATA_DIR / "dataset" / "genes.tsv"
DEFAULT_TRANSCRIPTS_IN = DATA_DIR / "dataset" / "transcripts.tsv"
DEFAULT_GENES_OUT = DATA_DIR / "genes.parquet"
DEFAULT_TRANSCRIPTS_OUT = DATA_DIR / "transcripts.parquet"

GENE_SCHEMA = {
    "id": pl.Utf8,
    "symbol": pl.Utf8,
    "name": pl.Utf8,
    "chromosome": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "strand": pl.Utf8,
    "length": pl.Int64,
    "alias": pl.Utf8,
    "category": pl.Utf8,
    "family": pl.Utf8,
    "family_name": pl.Utf8,
    "function_brief": pl.Utf8,
}

TRANSCRIPT_SCHEMA = {
    "id": pl.Utf8,
    "gene_id": pl.Utf8,
    "name": pl.Utf8,
    "type": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "length": pl.Int64,
}


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
