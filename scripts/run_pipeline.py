# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the full pipeline: preprocess (raw -> dataset) then build (dataset -> parquet).

Passes --skip-clustering / --skip-conservation and an optional HGNC file through to the
phases; --preprocess-only / --build-only run just one. The phases can also be run
directly (scripts/preprocess/run.py, scripts/build/run.py).
"""

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def main() -> None:
    args = sys.argv[1:]
    preprocess_only = "--preprocess-only" in args
    build_only = "--build-only" in args
    if preprocess_only and build_only:
        raise SystemExit("Use either --preprocess-only or --build-only, not both.")

    passthrough = [a for a in args if a not in ("--preprocess-only", "--build-only")]
    # The build phase ignores a positional HGNC file; only forward the recognized flags.
    build_args = [a for a in passthrough if a.startswith("--")]

    if not build_only:
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "preprocess" / "run.py"), *passthrough], check=True
        )

        # If preprocessing stopped at the family-names checkpoint, the dataset isn't ready yet
        if not (SCRIPT_DIR.parent / "reference" / "family_names.md").exists():
            return
        if preprocess_only:
            return
        if not (SCRIPT_DIR.parent / "backend" / "data" / "dataset" / "genes.tsv").exists():
            print("\nPreprocessing checkpoint reached; re-run to continue into the build.")
            return

    if not preprocess_only:
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "build" / "run.py"), *build_args], check=True
        )


if __name__ == "__main__":
    main()
