# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Convert a TSV file to Parquet.

Usage:
    python scripts/tsv_to_parquet.py [input.tsv] [output.parquet]

Defaults to backend/data/SLC_annotation.tsv -> backend/data/SLC_annotation.parquet.
"""

import sys
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_IN_PATH = DATA_DIR / "SLC_annotation.tsv"
DEFAULT_OUT_PATH = DATA_DIR / "SLC_annotation.parquet"


def convert(in_path: str, out_path: str) -> None:
    df = pl.read_csv(in_path, separator="\t", infer_schema_length=None)
    df.write_parquet(out_path)


def main() -> None:
    args = sys.argv[1:]
    in_path = args[0] if len(args) > 0 else DEFAULT_IN_PATH
    out_path = args[1] if len(args) > 1 else DEFAULT_OUT_PATH

    convert(in_path, out_path)


if __name__ == "__main__":
    main()
