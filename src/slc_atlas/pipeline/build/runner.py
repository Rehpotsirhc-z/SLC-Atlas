# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Run the build phase, which turns the files in source/ into the Parquet files that the
app serves out of app/.

The gene_tables step always runs. Each of the other steps builds one view and is left out
when that view's --skip flag is passed, and --step runs only the steps it names.
"""

import os
import shutil
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from ..lib.orchestration import Step, preflight, run_stage
from ..lib.paths import PipelinePaths
from . import (
    build_clustering,
    build_conservation,
    build_expression,
    build_gene_tables,
    build_structure,
)

STEP_NAMES = ("gene_tables", "clustering", "conservation", "expression", "structure")

# Every step apart from gene_tables is named after the view it builds, and so is its flag
ALWAYS = "gene_tables"

NO_MAFFT = (
    "clustering needs the MAFFT binary; install it (e.g. apt install mafft / "
    "brew install mafft), point --mafft at it, or pass --skip-clustering"
)


@dataclass(frozen=True)
class BuildOptions:
    mafft: str = ""
    skipped_views: frozenset[str] = frozenset()
    only_steps: tuple[str, ...] = ()


def _selected(options: BuildOptions) -> set[str]:
    if options.only_steps:
        return set(options.only_steps)
    views = set(STEP_NAMES) - {ALWAYS}
    return {ALWAYS} | (views - options.skipped_views)


def _resolve_mafft(explicit: str) -> str:
    mafft = explicit or os.environ.get("ATLAS_MAFFT") or shutil.which("mafft")
    if not mafft:
        raise SystemExit(NO_MAFFT)
    return mafft


def _steps(paths: PipelinePaths, mafft: str) -> dict[str, Step]:
    source, out = paths.source, paths.app
    structure_out = out / "structure"
    return {
        "gene_tables": Step(
            "gene_tables",
            lambda: build_gene_tables.run(source, out),
            label="Building the gene and transcript tables",
            outputs=(out / "genes.parquet", out / "transcripts.parquet"),
        ),
        "clustering": Step(
            "clustering",
            lambda: build_clustering.run(source, out, paths.work, mafft),
            label="Building the similarity trees",
            requires=("numpy", "scipy", "Bio"),
            outputs=(out / "clustering.parquet",),
        ),
        "conservation": Step(
            "conservation",
            lambda: build_conservation.run(source, out),
            label="Building the ortholog matrix and species tree",
            requires=("Bio",),
            outputs=(out / "conservation.parquet", out / "species_tree.parquet"),
        ),
        "expression": Step(
            "expression",
            lambda: build_expression.run(source, out),
            label="Building the expression matrix",
            outputs=(out / "expression.parquet",),
        ),
        "structure": Step(
            "structure",
            lambda: build_structure.run(source, out),
            label="Building the protein structure tables",
            outputs=(
                structure_out / "structure.parquet",
                structure_out / "features.parquet",
                structure_out / "experimental.parquet",
                structure_out / "sources.parquet",
            ),
        ),
    }


def _summary(steps: Sequence[Step], data_dir: Path) -> None:
    print("\nBuild complete. The app now has these files to serve:")
    for step in steps:
        for path in step.outputs:
            if path.exists():
                print(f"  {path.relative_to(data_dir)}  ({path.stat().st_size / 1e6:.1f} MB)")


def run(options: BuildOptions, paths: PipelinePaths) -> None:
    if not paths.source.is_dir():
        raise SystemExit(
            f"no source files at {paths.source}; run `atlas fetch` first or point --data-dir "
            "at a directory that has them"
        )
    selected = _selected(options)
    mafft = _resolve_mafft(options.mafft) if "clustering" in selected else ""
    steps = _steps(paths, mafft)
    chosen = [steps[name] for name in STEP_NAMES if name in selected]
    preflight(chosen)

    for step in chosen:
        run_stage([step])

    _summary(chosen, paths.data_dir)
