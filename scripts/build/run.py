# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the build phase: dataset/ -> the app-served Parquet files.

build_gene_tables always runs; build_clustering, build_conservation, and
build_expression are skipped with --skip-clustering / --skip-conservation /
--skip-expression.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.orchestration import run_script
from lib.pipeline_args import parse_args, skipped_views

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parents[1] / "data"

STEP_FOR_VIEW = {
    "clustering": "build_clustering",
    "conservation": "build_conservation",
    "expression": "build_expression",
    "structure": "build_structure",
}

# dataset/ and raw/ sit under DATA_DIR but are never served
UNSERVED_DIRS = {"dataset", "raw"}


def main() -> None:
    skipped = skipped_views(parse_args(__doc__))

    run_script(SCRIPT_DIR / "build_gene_tables.py")
    for view, step in STEP_FOR_VIEW.items():
        if view not in skipped:
            run_script(SCRIPT_DIR / f"{step}.py")

    print("\nBuild complete. App-served parquets:")
    for parquet in sorted(DATA_DIR.rglob("*.parquet")):
        relative = parquet.relative_to(DATA_DIR)
        if UNSERVED_DIRS & set(relative.parts):
            continue
        print(f"  {relative}  ({parquet.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
