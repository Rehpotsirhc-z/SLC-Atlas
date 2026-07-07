# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the build phase: dataset/ -> the app-served Parquet files.

build_gene_tables always runs; build_clustering, build_conservation, and
build_expression are skipped with --skip-clustering / --skip-conservation /
--skip-expression.
"""

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
DATA_DIR = ROOT / "backend" / "data"


def run_step(step: str) -> None:
    print(f"\n=== {step} ===", flush=True)
    subprocess.run([sys.executable, str(SCRIPT_DIR / f"{step}.py")], check=True)


def main() -> None:
    skip_clustering = "--skip-clustering" in sys.argv[1:]
    skip_conservation = "--skip-conservation" in sys.argv[1:]
    skip_expression = "--skip-expression" in sys.argv[1:]

    run_step("build_gene_tables")
    if not skip_clustering:
        run_step("build_clustering")
    if not skip_conservation:
        run_step("build_conservation")
    if not skip_expression:
        run_step("build_expression")

    print("\nBuild complete. App-served parquets:")
    for parquet in sorted(DATA_DIR.glob("*.parquet")):
        print(f"  {parquet.relative_to(ROOT)}  ({parquet.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
