# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The command lines for `atlas fetch` and `atlas build`.

Each subcommand has one list of options, and that list does two jobs. It registers the
command-line flags, and for the few options worth asking about it also supplies the
questions that prompting.py puts to the user, so the flags and the questions cannot fall
out of step with each other. No runner is imported at module level here, which is what
lets --help work before the pipeline dependencies have been installed.
"""

import argparse
import os
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

from . import prompting
from .options import Option, StepName, register, resolve

if TYPE_CHECKING:
    from .lib.paths import PipelinePaths

VIEWS = ("clustering", "conservation", "expression", "structure")

SKIP_HELP = {
    "clustering": "skip the similarity trees, which are built from expression and sequences",
    "conservation": "skip the ortholog matrix and species tree",
    "expression": "skip the gene-by-tissue expression matrix",
    "structure": "skip the protein models, topology, and coordinate downloads",
}

BUILD_SKIP_HELP = SKIP_HELP | {
    "clustering": "skip the similarity trees, the only step that needs MAFFT"
}

TREE_SOURCES = ("ensembl_compara", "ncbi", "timetree", "ucsc")

BAD_SOURCE = (
    "{source!r} is neither an HGNC group id nor a file that exists; pass a group id like "
    "752, a gene-list file, or a downloaded HGNC group TSV"
)

GROUP_TSV_HEADER = "HGNC ID\t"


def _settings_data_dir(_: Mapping[str, Any]) -> Path:
    from ..config import settings

    return settings.data_dir


FETCH = (
    Option(
        "source",
        "HGNC group id (digits), a gene-list file (one symbol or Ensembl gene id per line, "
        "# comments), or a pre-downloaded HGNC group TSV",
        default="",
        positional=True,
        prompt="HGNC group id, gene-list file, or HGNC group TSV",
    ),
    Option(
        "data_dir",
        "directory for curation/, source/, app/, and cache/ (default: $ATLAS_DATA_DIR)",
        default=_settings_data_dir,
        metavar="PATH",
        parse=Path,
        prompt="Data directory",
    ),
    Option(
        "curation_dir",
        "editable curation files, seeded on the first run (default: <data-dir>/curation)",
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
        "local TPM matrix (.gct.gz or .parquet) instead of downloading one",
        default=None,
        metavar="PATH",
        parse=Path,
    ),
    Option(
        "ensembl_release",
        "Ensembl release for the pinned Compara species-tree URLs",
        default=116,
        metavar="N",
        parse=int,
        prompt="Ensembl release",
    ),
    Option(
        "download_predicted",
        "mirror the AlphaFold models instead of streaming them from AlphaFold DB",
        prompt="Mirror the predicted models?",
    ),
    Option(
        "download_experimental",
        "mirror every PDB entry instead of streaming them from RCSB",
        prompt="Mirror the experimental models?",
    ),
    Option("tree_source", "species-tree provider", default="ensembl_compara", choices=TREE_SOURCES),
    Option(
        "promote_alias_prefix",
        "show genes under an alias starting with this prefix wherever one exists, "
        "rather than under their approved symbol",
        default="",
        metavar="PREFIX",
    ),
    Option(
        "accept_seeds",
        "keep going on the first run instead of stopping to let you edit the curation files",
    ),
    *(Option(f"skip_{view}", SKIP_HELP[view]) for view in VIEWS),
    Option(
        "step",
        "run one named step and nothing else; repeat the flag to run several. This "
        "overrides the --skip flags and does not stop for curation editing",
        default=(),
        metavar="NAME",
        parse=StepName("fetch"),
        multiple=True,
    ),
)

BUILD = (
    Option(
        "data_dir",
        "directory holding source/, receiving the served parquet in app/ "
        "(default: $ATLAS_DATA_DIR)",
        default=_settings_data_dir,
        metavar="PATH",
        parse=Path,
    ),
    *(Option(f"skip_{view}", BUILD_SKIP_HELP[view]) for view in VIEWS),
    Option(
        "step",
        "run one named step and nothing else; repeat the flag to run several",
        default=(),
        metavar="NAME",
        parse=StepName("build"),
        multiple=True,
    ),
    Option(
        "mafft",
        "MAFFT binary for the alignments (default: $ATLAS_MAFFT, else the one on PATH)",
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
        # A directory the user was asked for did not pass through the settings flags in main()
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
    print(f"Source: {_source_label(source)}")

    from .fetch.runner import FetchOptions, run

    halted = run(
        FetchOptions(
            source=source,
            gtex_version=chosen["gtex_version"],
            gtex_file=chosen["gtex_file"],
            ensembl_release=chosen["ensembl_release"],
            tree_source=chosen["tree_source"],
            promote_prefix=chosen["promote_alias_prefix"],
            download_predicted=chosen["download_predicted"],
            download_experimental=chosen["download_experimental"],
            accept_seeds=chosen["accept_seeds"],
            skipped_views=_skipped(chosen),
            only_steps=tuple(chosen["step"]),
        ),
        _paths(chosen),
    )
    if halted:
        print(f"\nWhen you are done, continue the fetch with:\n\n  {rerun}\n")
    return 0


def _build(args: argparse.Namespace) -> int:
    chosen = resolve(BUILD, args)
    from .build.runner import BuildOptions, run

    run(
        BuildOptions(
            mafft=chosen["mafft"],
            skipped_views=_skipped(chosen),
            only_steps=tuple(chosen["step"]),
        ),
        _paths(chosen),
    )
    return 0


def add_parsers(sub: argparse._SubParsersAction) -> None:
    # Without allow_abbrev off, argparse would accept a truncated typo like --skip-clusterin
    fetch = sub.add_parser(
        "fetch",
        help="download a gene family as plain, editable source files",
        description="Download a gene family from public sources and write it out as plain, "
        "editable source files. Run it with no source for a short interactive setup.",
        allow_abbrev=False,
    )
    register(fetch, FETCH)
    fetch.set_defaults(func=_fetch)

    build = sub.add_parser(
        "build",
        help="compile the source files into what the app serves",
        description="Turn the source files into the Parquet files the app serves, written to app/.",
        allow_abbrev=False,
    )
    register(build, BUILD)
    build.set_defaults(func=_build)
