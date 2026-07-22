# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Convert files between TSV and Parquet, dispatching on the input extension.

Usage:
    python scripts/utils/convert.py file1.tsv [file2.parquet ...]

Output is written alongside each input with the extension swapped.
"""

import sys
from pathlib import Path

import polars as pl


def tsv_to_parquet(in_path: Path, out_path: Path) -> None:
    pl.read_csv(in_path, separator="\t", infer_schema_length=None).write_parquet(out_path)


def parquet_to_tsv(in_path: Path, out_path: Path) -> None:
    pl.read_parquet(in_path).write_csv(out_path, separator="\t")


CONVERTERS = {".tsv": (".parquet", tsv_to_parquet), ".parquet": (".tsv", parquet_to_tsv)}


def convert(in_path: Path) -> None:
    target = CONVERTERS.get(in_path.suffix.lower())
    if target is None:
        raise SystemExit(f"{in_path}: expected one of {', '.join(CONVERTERS)}")
    suffix, run = target
    out_path = in_path.with_suffix(suffix)
    run(in_path, out_path)
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
