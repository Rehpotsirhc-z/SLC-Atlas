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
from dataclasses import dataclass, replace
from pathlib import Path

from ...config import COMMAND_NAME
from ..lib import console, interrupt, progress, windows
from ..lib.orchestration import Ledger, Step, preflight, run_stage, summarize
from ..lib.paths import PipelinePaths
from . import (
    build_browser,
    build_clustering,
    build_conservation,
    build_expression,
    build_gene_tables,
    build_structure,
)

STEP_NAMES = ("gene_tables", "browser", "clustering", "conservation", "expression", "structure")

# Every step apart from gene_tables is named after the view it builds, and so is its flag
ALWAYS = "gene_tables"

NO_MAFFT = (
    "The Clustering view needs MAFFT. Install it with `apt install mafft` or "
    "`brew install mafft`, pass its location with --mafft, or use --skip-clustering."
)


@dataclass(frozen=True)
class BuildOptions:
    mafft: str = ""
    browser_flank_min: int = windows.FLANK_MIN
    browser_flank_max: int = windows.FLANK_MAX
    skipped_views: frozenset[str] = frozenset()
    only_steps: tuple[str, ...] = ()


def _selected(options: BuildOptions) -> set[str]:
    if options.only_steps:
        return set(options.only_steps)
    views = set(STEP_NAMES) - {ALWAYS}
    return {ALWAYS} | (views - options.skipped_views)


def _resolve_mafft(explicit: str) -> str:
    mafft = explicit or os.environ.get("ATLASFORGE_MAFFT") or shutil.which("mafft")
    if not mafft:
        raise SystemExit(NO_MAFFT)
    return mafft


def _clustering(paths: PipelinePaths, options: BuildOptions) -> None:
    # Resolved here rather than up front so that a machine with no MAFFT still builds the
    # other five views instead of stopping the whole command
    build_clustering.run(paths.source, paths.app, paths.work, _resolve_mafft(options.mafft))


def _steps(paths: PipelinePaths, options: BuildOptions) -> dict[str, Step]:
    source, out = paths.source, paths.app
    structure_out, browser_out = out / "structure", out / "browser"
    genes, transcripts = source / "genes.tsv", source / "transcripts.tsv"
    return {
        "gene_tables": Step(
            "gene_tables",
            lambda: build_gene_tables.run(source, out),
            label="Building the gene and transcript tables",
            inputs=(genes, transcripts),
            outputs=(out / "genes.parquet", out / "transcripts.parquet"),
        ),
        "browser": Step(
            "browser",
            lambda: build_browser.run(
                source,
                out,
                flank_min=options.browser_flank_min,
                flank_max=options.browser_flank_max,
            ),
            label="Building the genome browser tables",
            requires=("pybigtools",),
            inputs=(genes, source / "browser" / "transcripts.bed", source / "browser" / "chroms.tsv"),
            outputs=(
                browser_out / "windows.parquet",
                browser_out / "models.bb",
                browser_out / "genes.parquet",
                browser_out / "tracks.parquet",
                browser_out / "chroms.parquet",
                browser_out / "studies.parquet",
                browser_out / "sources.parquet",
            ),
        ),
        "clustering": Step(
            "clustering",
            lambda: _clustering(paths, options),
            label="Building the similarity trees",
            requires=("numpy", "scipy", "Bio"),
            inputs=(genes, source / "cds.fasta", source / "protein.fasta"),
            outputs=(out / "clustering.parquet",),
        ),
        "conservation": Step(
            "conservation",
            lambda: build_conservation.run(source, out),
            label="Building the ortholog matrix and species tree",
            requires=("Bio",),
            inputs=(genes, source / "orthologs.tsv", source / "species_tree.nwk"),
            outputs=(out / "conservation.parquet", out / "species_tree.parquet"),
        ),
        "expression": Step(
            "expression",
            lambda: build_expression.run(source, out),
            label="Building the expression matrix",
            inputs=(genes, source / "expression.parquet", source / "sample_tissue.tsv"),
            outputs=(out / "expression.parquet",),
        ),
        "structure": Step(
            "structure",
            lambda: build_structure.run(source, out),
            label="Building the protein structure tables",
            inputs=(source / "structure" / "uniprot_map.tsv",),
            outputs=(
                structure_out / "structure.parquet",
                structure_out / "features.parquet",
                structure_out / "experimental.parquet",
                structure_out / "sources.parquet",
            ),
        ),
    }


def _summary(
    steps: Sequence[Step],
    data_dir: Path,
    whole: bool,
    serve_command: str = "",
    export_command: str = "",
) -> None:
    console.blank()
    if whole:
        console.success("The atlas is ready with these files:")
    else:
        console.warn("Build incomplete. These files are available:")
    for step in steps:
        for path in step.outputs:
            if path.exists() and path.is_file():
                size = path.stat().st_size / 1024**2
                console.detail(f"{path.relative_to(data_dir)}  ({size:.1f} MiB)", indent=2)
    if whole and (serve_command or export_command):
        console.blank()
        console.success("Serve it locally with:")
        console.detail(serve_command, indent=2)
        console.success("or write a static site with:")
        console.detail(export_command, indent=2)


def run(
    options: BuildOptions,
    paths: PipelinePaths,
    serve_command: str = "",
    export_command: str = "",
) -> bool:
    """Build every view that can be built, and say whether anything went wrong."""
    if not paths.source.is_dir():
        raise SystemExit(
            f"No source files were found in {paths.source}. Run `{COMMAND_NAME} fetch` first, "
            "or use --data-dir with an existing dataset."
        )
    selected = _selected(options)
    steps = _steps(paths, options)
    # A build output is a function of source files the user edits by hand, so its being on
    # disk says nothing about whether it is still the right answer
    chosen = [replace(steps[name], skip_when_present=False) for name in STEP_NAMES if name in selected]
    preflight(chosen)

    # No build step reads another's output, so each one stands or falls on its own
    ledger = Ledger()
    with interrupt.handler(), progress.display():
        for step in chosen:
            run_stage([step], ledger, frozenset(options.only_steps))

    summarize(ledger, "Build", f"{COMMAND_NAME} build")
    _summary(chosen, paths.data_dir, not ledger.unusable, serve_command, export_command)
    return ledger.unusable
