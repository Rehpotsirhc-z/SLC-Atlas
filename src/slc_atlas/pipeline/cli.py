# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Define the `atlas fetch` and `atlas build` commands"""

import argparse
import os
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

from . import prompting
from .lib import console
from .lib.windows import FLANK_MAX as WINDOW_FLANK_MAX, FLANK_MIN as WINDOW_FLANK_MIN
from .options import Option, StepName, register, resolve

if TYPE_CHECKING:
    from .lib.paths import PipelinePaths

VIEWS = ("browser", "clustering", "conservation", "expression", "structure")

SKIP_HELP = {
    "browser": "leave out the Genome Browser view, its gene models, coverage, and GWAS",
    "clustering": "leave out the Clustering view and its similarity trees",
    "conservation": "leave out the Conservation view and species tree",
    "expression": "leave out the Expression view and tissue matrix",
    "structure": "leave out the Structure view and protein models",
}

BUILD_SKIP_HELP = SKIP_HELP | {
    "clustering": "leave out the Clustering view, the only build step that needs MAFFT"
}

TREE_SOURCES = ("ensembl_compara", "ncbi", "timetree", "ucsc")

BAD_SOURCE = (
    "Could not find {source!r}. Enter an HGNC group ID such as 752, a gene-list file, or "
    "a downloaded HGNC group TSV."
)

GROUP_TSV_HEADER = "HGNC ID\t"


def _settings_data_dir(_: Mapping[str, Any]) -> Path:
    from ..config import settings

    return settings.data_dir


FETCH = (
    Option(
        "source",
        "HGNC group ID, gene-list file with one symbol or Ensembl gene ID per line, or "
        "downloaded HGNC group TSV",
        default="",
        positional=True,
        prompt="HGNC group ID or gene-list file",
    ),
    Option(
        "data_dir",
        "dataset directory for curation/, source/, cache/, and app/",
        default=_settings_data_dir,
        metavar="PATH",
        parse=Path,
        prompt="Data directory",
    ),
    Option(
        "curation_dir",
        "directory for editable family choices",
        default=lambda chosen: Path(chosen["data_dir"]) / "curation",
        metavar="PATH",
        parse=Path,
        prompt="Curation directory",
    ),
    Option(
        "gtex_version",
        "GTEx release for the TPM and sample-attribute downloads",
        default="v11",
        choices=("v8", "v10", "v11"),
        prompt="GTEx release",
    ),
    Option(
        "gtex_file",
        "local GTEx TPM matrix (.gct.gz or .parquet) to use instead of a download",
        default=None,
        metavar="PATH",
        parse=Path,
    ),
    Option(
        "ensembl_release",
        "Ensembl release used for the Compara species tree",
        default=116,
        metavar="N",
        parse=int,
        prompt="Ensembl release",
    ),
    Option(
        "download_predicted",
        "download AlphaFold models for local hosting",
        prompt="Download the predicted models?",
    ),
    Option(
        "download_experimental",
        "download every PDB entry for local hosting",
        prompt="Download the experimental models?",
    ),
    Option(
        "gene_models_file",
        "local GTF, GFF3, or BED12 of transcript models to use instead of a GENCODE download",
        default=None,
        metavar="PATH",
        parse=Path,
    ),
    Option(
        "gencode_release",
        "GENCODE release for the gene models, by default the one merged from --ensembl-release",
        default="",
        metavar="N",
    ),
    Option(
        "browser_tracks",
        "bigWig file or directory used to seed coverage curation; repeat for multiple inputs",
        default=(),
        metavar="PATH",
        parse=Path,
        multiple=True,
    ),
    Option(
        "browser_gwas",
        "summary-statistics file or directory used to seed one GWAS study; repeat per study",
        default=(),
        metavar="PATH",
        parse=Path,
        multiple=True,
    ),
    Option(
        "browser_flank_min",
        "smallest context kept on each side of a gene in the browser",
        default=WINDOW_FLANK_MIN,
        metavar="BASES",
        parse=int,
    ),
    Option(
        "browser_flank_max",
        "largest context kept on each side of a gene in the browser",
        default=WINDOW_FLANK_MAX,
        metavar="BASES",
        parse=int,
    ),
    Option(
        "browser_bin",
        "finest resolution kept in a local coverage copy; 0 keeps the source resolution, and "
        "a track already coarser than this is never made coarser still",
        default=25,
        metavar="BASES",
        parse=int,
    ),
    Option(
        "browser_max_bytes",
        "refuse to copy coverage tracks that would add more than this to the site",
        default=500_000_000,
        metavar="BYTES",
        parse=int,
    ),
    Option(
        "local_coverage",
        "copy the coverage tracks into the site instead of reading them from their origin",
        prompt="Copy the coverage tracks locally?",
    ),
    Option(
        "browser_whole_genome",
        "keep the whole genome in the browser rather than slicing its coverage, gene models, "
        "and GWAS to windows around the family's genes",
        prompt="Keep the whole genome, rather than slicing to the family's genes?",
    ),
    Option(
        "tree_source",
        "source used to build the species tree",
        default="ensembl_compara",
        choices=TREE_SOURCES,
    ),
    Option(
        "promote_alias_prefix",
        "prefer aliases that begin with this prefix as display symbols",
        default="",
        metavar="PREFIX",
    ),
    Option(
        "no_review",
        "skip the pause for reviewing newly created curation files",
    ),
    *(Option(f"skip_{view}", SKIP_HELP[view]) for view in VIEWS),
    Option(
        "step",
        "run only this fetch step, along with the HGNC step that seeds curation; repeat to "
        "select more than one",
        default=(),
        metavar="NAME",
        parse=StepName("fetch"),
        multiple=True,
    ),
)

BUILD = (
    Option(
        "data_dir",
        "dataset directory containing source/ and receiving the built app/ files",
        default=_settings_data_dir,
        metavar="PATH",
        parse=Path,
    ),
    *(Option(f"skip_{view}", BUILD_SKIP_HELP[view]) for view in VIEWS),
    Option(
        "browser_flank_min",
        "smallest context kept on each side of a gene in the browser",
        default=WINDOW_FLANK_MIN,
        metavar="BASES",
        parse=int,
    ),
    Option(
        "browser_flank_max",
        "largest context kept on each side of a gene in the browser",
        default=WINDOW_FLANK_MAX,
        metavar="BASES",
        parse=int,
    ),
    Option(
        "step",
        "run only this build step; repeat to select more than one",
        default=(),
        metavar="NAME",
        parse=StepName("build"),
        multiple=True,
    ),
    Option(
        "mafft",
        "MAFFT executable to use for sequence alignments",
        default="",
        metavar="PATH",
    ),
)


def _skipped(chosen: Mapping[str, Any]) -> frozenset[str]:
    return frozenset(view for view in VIEWS if chosen[f"skip_{view}"])


def _paths(chosen: Mapping[str, Any]) -> "PipelinePaths":
    from ..config import refresh, settings
    from .lib.paths import PipelinePaths

    data_dir = Path(chosen["data_dir"])
    if data_dir != settings.data_dir:
        os.environ["ATLAS_DATA_DIR"] = str(data_dir)
        refresh()
    return PipelinePaths(data_dir, Path(chosen.get("curation_dir") or data_dir / "curation"))


def _source_label(source: str) -> str:
    if source.isdigit():
        return f"HGNC group {source}"
    path = Path(source)
    if not path.is_file():
        raise SystemExit(BAD_SOURCE.format(source=source))
    with path.open(encoding="utf-8", errors="replace") as handle:
        kind = "HGNC group TSV" if handle.readline().startswith(GROUP_TSV_HEADER) else "gene list"
    return f"{kind} {path}"


def _fetch(args: argparse.Namespace) -> int:
    ask = prompting.asker(FETCH, args)
    chosen = resolve(FETCH, args, ask)
    source = str(chosen["source"])
    if not source:
        raise SystemExit(prompting.NO_SOURCE)
    rerun = prompting.command_line("fetch", FETCH, chosen)
    if ask:
        prompting.echo(rerun)
    console.detail(f"Source: {_source_label(source)}")

    from .fetch.plan import FetchOptions
    from .fetch.runner import run

    halted, unusable = run(
        FetchOptions(
            source=source,
            gtex_version=chosen["gtex_version"],
            gtex_file=chosen["gtex_file"],
            ensembl_release=chosen["ensembl_release"],
            tree_source=chosen["tree_source"],
            promote_prefix=chosen["promote_alias_prefix"],
            download_predicted=chosen["download_predicted"],
            download_experimental=chosen["download_experimental"],
            gene_models_file=chosen["gene_models_file"],
            gencode_release=chosen["gencode_release"],
            browser_tracks=tuple(chosen["browser_tracks"]),
            browser_gwas=tuple(chosen["browser_gwas"]),
            browser_flank_min=chosen["browser_flank_min"],
            browser_flank_max=chosen["browser_flank_max"],
            browser_bin=chosen["browser_bin"],
            browser_max_bytes=chosen["browser_max_bytes"],
            local_coverage=chosen["local_coverage"],
            browser_whole_genome=chosen["browser_whole_genome"],
            no_review=chosen["no_review"],
            skipped_views=_skipped(chosen),
            only_steps=tuple(chosen["step"]),
        ),
        _paths(chosen),
    )
    if halted:
        console.blank()
        console.detail("When the curation files are ready, continue with:")
        console.detail(rerun, indent=2)
    return 1 if unusable else 0


def _build(args: argparse.Namespace) -> int:
    chosen = resolve(BUILD, args)
    from .build.runner import BuildOptions, run

    unusable = run(
        BuildOptions(
            mafft=chosen["mafft"],
            browser_flank_min=chosen["browser_flank_min"],
            browser_flank_max=chosen["browser_flank_max"],
            skipped_views=_skipped(chosen),
            only_steps=tuple(chosen["step"]),
        ),
        _paths(chosen),
    )
    return 1 if unusable else 0


def add_parsers(sub: argparse._SubParsersAction) -> None:
    fetch = sub.add_parser(
        "fetch",
        help="create editable source files for a gene family",
        description="Gather a gene family from public sources. Run without a source to "
        "choose the main options interactively.",
        allow_abbrev=False,
    )
    register(fetch, FETCH)
    fetch.set_defaults(func=_fetch)

    build = sub.add_parser(
        "build",
        help="build an atlas from its source files",
        description="Build the files the atlas reads and write them to app/.",
        allow_abbrev=False,
    )
    register(build, BUILD)
    build.set_defaults(func=_build)
