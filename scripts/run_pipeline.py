# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the full pipeline: preprocess (raw -> dataset) then build (dataset -> parquet).

Forwards the --skip-* flags and an optional HGNC file to the phases;
--preprocess-only / --build-only run just one. Each phase can also be run directly
(scripts/preprocess/run.py, scripts/build/run.py).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.orchestration import run_script
from lib.pipeline_args import parse_args, skip_flags

SCRIPT_DIR = Path(__file__).resolve().parent
GENES_TSV = SCRIPT_DIR.parent / "backend" / "data" / "dataset" / "genes.tsv"


def main() -> None:
    args = parse_args(__doc__, phase_flags=True, hgnc_file=True)
    if args.preprocess_only and args.build_only:
        raise SystemExit("Use either --preprocess-only or --build-only, not both")

    flags = skip_flags(args)

    if not args.build_only:
        preprocess_args = [*flags, args.hgnc_file] if args.hgnc_file else flags
        run_script(SCRIPT_DIR / "preprocess" / "run.py", preprocess_args, label="preprocess")
        if args.preprocess_only:
            return
        if not GENES_TSV.exists():
            print("\nPreprocessing checkpoint reached; re-run to continue into the build.")
            return

    if not args.preprocess_only:
        run_script(SCRIPT_DIR / "build" / "run.py", flags, label="build")


if __name__ == "__main__":
    main()
