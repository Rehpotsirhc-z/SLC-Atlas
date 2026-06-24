# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Convert one or more Parquet files to TSV.

Usage:
    python scripts/utils/parquet_to_tsv.py file1.parquet [file2.parquet ...]

Output is written alongside each input with the extension replaced by .tsv.
"""

import sys
from pathlib import Path

import polars as pl


def convert(in_path: Path) -> None:
    out_path = in_path.with_suffix(".tsv")
    pl.read_parquet(in_path).write_csv(out_path, separator="\t")
    print(f"Wrote {out_path}")


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    for arg in args:
        convert(Path(arg))


if __name__ == "__main__":
    main()
