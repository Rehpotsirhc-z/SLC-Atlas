# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the preprocessing phase: raw downloads -> the standard-format dataset.

Stages run in order; a stage with more than one step runs in parallel. A step is
skipped only when every view that consumes it is skipped (--skip-clustering /
--skip-conservation / --skip-expression).
"""

import sys
from argparse import Namespace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.orchestration import run_parallel, run_script
from lib.pipeline_args import parse_args, skipped_views

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
RAW = ROOT / "data" / "raw"
DATASET = ROOT / "data" / "dataset"
NAMES_FILE = ROOT / "reference" / "family_names.md"

STAGES = [
    ["annotate_genes"],
    ["fetch_ensembl_genes", "fetch_ncbi_summaries"],
    ["assemble_genes"],
    ["subset_expression", "fetch_sequences"],
    ["fetch_orthologs", "fetch_species_tree"],
    ["fetch_uniprot_map"],
    ["fetch_protein_features", "fetch_structures", "fetch_uniprot_sequences"],
    ["download_models", "download_experimental_models", "fetch_confidence"],
]

CONSUMED_BY = {
    "subset_expression": {"clustering", "expression"},
    "fetch_sequences": {"clustering", "structure"},
    "fetch_orthologs": {"conservation"},
    "fetch_species_tree": {"conservation"},
    "fetch_uniprot_map": {"structure"},
    "fetch_protein_features": {"structure"},
    "fetch_structures": {"structure"},
    "fetch_uniprot_sequences": {"structure"},
    "download_models": {"structure"},
    "download_experimental_models": {"structure"},
    "fetch_confidence": {"structure"},
}

DOWNLOAD_KIND = {
    "download_models": "predicted",
    "download_experimental_models": "experimental",
}


def step_args(step: str, args: Namespace) -> list[str]:
    if step == "annotate_genes" and args.hgnc_file:
        return [args.hgnc_file, str(NAMES_FILE), str(RAW / "annotation.tsv")]
    kind = DOWNLOAD_KIND.get(step)
    if kind and getattr(args, f"download_{kind}"):
        return [f"--download-{kind}"]
    return []


def run_stage(steps: list[str], args: Namespace) -> None:
    if len(steps) == 1:
        step = steps[0]
        run_script(SCRIPT_DIR / f"{step}.py", step_args(step, args))
        return
    run_parallel([(SCRIPT_DIR / f"{step}.py", step_args(step, args)) for step in steps])


def main() -> None:
    args = parse_args(__doc__, hgnc_file=True)

    # Human-in-the-loop checkpoint: stop after writing family_names.md so the user can
    # choose each family's display name (the fetch never overwrites an existing file)
    if not NAMES_FILE.exists():
        run_script(SCRIPT_DIR / "fetch_family_names.py")
        print("\n=== Action needed ===")
        print(f"Wrote {NAMES_FILE}")
        print("Edit it to choose each family's display name (the first bullet under")
        print("each heading wins), then re-run this script to continue preprocessing.")
        return

    skipped = skipped_views(args)
    skip = {step for step, views in CONSUMED_BY.items() if views <= skipped}

    for stage in STAGES:
        sel = [s for s in stage if s not in skip]
        if sel:
            run_stage(sel, args)

    print(f"\nPreprocessing complete. Standard-format dataset in {DATASET}")


if __name__ == "__main__":
    main()
