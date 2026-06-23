# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the data pipeline.

Each step is an independent script in this directory; this orchestrator runs them
in order, parallelising the steps that don't depend on each other. It shells out
with the current Python interpreter (sys.executable), so it works on any platform
without relying on a particular shell.

Steps 06-08 (GTEx subset, sequences, clustering) require large external files and
take the longest, so they are skipped with --skip-clustering.

By default the full pipeline runs (02 -> 08). To re-run only part of it, use
--from or --only to avoid re-hitting the slow external APIs:

Usage:
    python scripts/run_pipeline.py [--skip-clustering] [hgnc_genes.txt]
    python scripts/run_pipeline.py --from 5            # run step 05 onward
    python scripts/run_pipeline.py --only 2,5          # run only steps 02 and 05

Step numbers may be given with or without a leading zero (2 == 02). Parallel pairs
(03+04, 06+07) still run concurrently when both are selected.
"""

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
RAW = ROOT / "backend" / "data" / "raw"
NAMES_FILE = RAW / "family_names.md"

STEP_SCRIPTS = {
    "01": "01_fetch_hgnc_aliases.py",
    "02": "02_annotate_genes.py",
    "03": "03_fetch_ensembl_genes.py",
    "04": "04_fetch_ncbi_summaries.py",
    "05": "05_build_gene_tables.py",
    "06": "06_fetch_gtex_subset.py",
    "07": "07_fetch_sequences.py",
    "08": "08_build_clustering.py",
}

# Execution stages in pipeline order; a stage with more than one step runs in parallel.
STAGES = [["01"], ["02"], ["03", "04"], ["05"], ["06", "07"], ["08"]]
CLUSTERING_STEPS = {"06", "07", "08"}


def normalize(step: str) -> str:
    key = step.strip().zfill(2)
    if key not in STEP_SCRIPTS:
        raise SystemExit(f"Unknown step: {step!r} (valid: {', '.join(STEP_SCRIPTS)})")
    return key


def step_args(step: str, hgnc_file: str) -> list[str]:
    """Only step 02 takes extra arguments, and only when a custom HGNC file is given."""
    if step == "02" and hgnc_file:
        return [hgnc_file, str(NAMES_FILE), str(RAW / "annotation.tsv")]
    return []


def run_stage(steps: list[str], hgnc_file: str) -> None:
    """Run a stage to completion, in parallel if it has more than one step."""
    if len(steps) == 1:
        step = steps[0]
        print(f"\n=== {STEP_SCRIPTS[step]} ===", flush=True)
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / STEP_SCRIPTS[step]), *step_args(step, hgnc_file)],
            check=True,
        )
        return

    procs = []
    for step in steps:
        print(f"\n=== {STEP_SCRIPTS[step]} (started) ===", flush=True)
        procs.append(
            (step, subprocess.Popen([sys.executable, str(SCRIPT_DIR / STEP_SCRIPTS[step])]))
        )
    failed = [step for step, proc in procs if proc.wait() != 0]
    if failed:
        raise SystemExit("Step(s) failed: " + ", ".join(STEP_SCRIPTS[s] for s in failed))


def run_selection(selected: set[str], hgnc_file: str) -> None:
    """Run the selected steps, preserving pipeline order and parallel grouping."""
    for stage in STAGES:
        sel = [s for s in stage if s in selected]
        if sel:
            run_stage(sel, hgnc_file)


def print_parquet_summary() -> None:
    print("\nPipeline complete. App-served parquets:")
    for parquet in sorted((ROOT / "backend" / "data").glob("*.parquet")):
        print(f"  {parquet.relative_to(ROOT)}  ({parquet.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    skip_clustering = False
    hgnc_file = ""
    from_step = None
    only_steps = None

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--skip-clustering":
            skip_clustering = True
        elif arg == "--from":
            i += 1
            from_step = normalize(args[i])
        elif arg.startswith("--from="):
            from_step = normalize(arg.split("=", 1)[1])
        elif arg == "--only":
            i += 1
            only_steps = {normalize(s) for s in args[i].split(",") if s.strip()}
        elif arg.startswith("--only="):
            only_steps = {normalize(s) for s in arg.split("=", 1)[1].split(",") if s.strip()}
        else:
            hgnc_file = arg
        i += 1

    if from_step is not None and only_steps is not None:
        raise SystemExit("Use either --from or --only, not both.")

    # Targeted re-runs skip the step-01 checkpoint and run exactly what's asked.
    if only_steps is not None:
        run_selection(only_steps, hgnc_file)
        return

    if from_step is not None:
        selected = {s for s in STEP_SCRIPTS if s >= from_step}
        if skip_clustering:
            selected -= CLUSTERING_STEPS
        run_selection(selected, hgnc_file)
        print_parquet_summary()
        return

    # Default full run. Step 01 is a human-in-the-loop checkpoint: on the first run we
    # fetch the families, write family_names.md, and stop so the user can choose each
    # family's display name. Edits are preserved (01 never overwrites an existing file),
    # so the user can edit it whenever and re-run to continue.
    if not NAMES_FILE.exists():
        run_stage(["01"], hgnc_file)
        print("\n=== Action needed ===")
        print(f"Wrote {NAMES_FILE}.")
        print("Edit it to choose each family's display name (the first bullet under")
        print("each heading wins), then re-run this script to continue the pipeline.")
        return

    selected = {s for s in STEP_SCRIPTS if s != "01"}
    if skip_clustering:
        selected -= CLUSTERING_STEPS
        run_selection(selected, hgnc_file)
        print("\nSkipping steps 06-08 (--skip-clustering). Run them manually when ready:")
        for step in sorted(CLUSTERING_STEPS):
            print(f"  python scripts/{STEP_SCRIPTS[step]}")
        return

    run_selection(selected, hgnc_file)
    print_parquet_summary()


if __name__ == "__main__":
    main()
