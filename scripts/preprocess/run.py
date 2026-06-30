# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the preprocessing phase: raw downloads -> the standard-format dataset.

Steps run in order; bracketed groups run in parallel. Clustering inputs
(sequences/expression) are skipped with --skip-clustering; conservation inputs
(orthologs/species tree) with --skip-conservation.
"""

import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
RAW = ROOT / "backend" / "data" / "raw"
NAMES_FILE = ROOT / "reference" / "family_names.md"

# Execution stages in order; a stage with more than one step runs in parallel.
STAGES = [
    ["annotate_genes"],
    ["fetch_ensembl_genes", "fetch_ncbi_summaries"],
    ["assemble_genes"],
    ["subset_expression", "fetch_sequences"],
    ["fetch_orthologs", "fetch_species_tree"],
]
CLUSTERING_STEPS = {"subset_expression", "fetch_sequences"}
CONSERVATION_STEPS = {"fetch_orthologs", "fetch_species_tree"}


def step_args(step: str, hgnc_file: str) -> list[str]:
    """Only annotate_genes takes extra args, and only for a custom HGNC file."""
    if step == "annotate_genes" and hgnc_file:
        return [hgnc_file, str(NAMES_FILE), str(RAW / "annotation.tsv")]
    return []


def run_stage(steps: list[str], hgnc_file: str) -> None:
    if len(steps) == 1:
        step = steps[0]
        print(f"\n=== {step} ===", flush=True)
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / f"{step}.py"), *step_args(step, hgnc_file)],
            check=True,
        )
        return

    procs = []
    for step in steps:
        print(f"\n=== {step} (started) ===", flush=True)
        procs.append((step, subprocess.Popen([sys.executable, str(SCRIPT_DIR / f"{step}.py")])))
    failed = [step for step, proc in procs if proc.wait() != 0]
    if failed:
        raise SystemExit("Step(s) failed: " + ", ".join(failed))


def main() -> None:
    skip_clustering = False
    skip_conservation = False
    hgnc_file = ""
    for arg in sys.argv[1:]:
        if arg == "--skip-clustering":
            skip_clustering = True
        elif arg == "--skip-conservation":
            skip_conservation = True
        else:
            hgnc_file = arg

    # Step 01 is a human-in-the-loop checkpoint: on the first run we fetch the family
    # names, write family_names.md, and stop so the user can choose each family's
    # display name. Edits are preserved (the fetch never overwrites an existing file).
    if not NAMES_FILE.exists():
        print("\n=== fetch_family_names ===", flush=True)
        subprocess.run([sys.executable, str(SCRIPT_DIR / "fetch_family_names.py")], check=True)
        print("\n=== Action needed ===")
        print(f"Wrote {NAMES_FILE}.")
        print("Edit it to choose each family's display name (the first bullet under")
        print("each heading wins), then re-run this script to continue preprocessing.")
        return

    skip: set[str] = set()
    if skip_clustering:
        skip |= CLUSTERING_STEPS
    if skip_conservation:
        skip |= CONSERVATION_STEPS

    for stage in STAGES:
        sel = [s for s in stage if s not in skip]
        if sel:
            run_stage(sel, hgnc_file)

    print(f"\nPreprocessing complete. Standard-format dataset in {ROOT / 'backend' / 'data' / 'dataset'}")


if __name__ == "__main__":
    main()
