# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Command line shared by run_pipeline.py and both phase runners.

The --skip-* flags name views, not steps: each phase maps them onto its own steps.
The --download-* flags name a kind of coordinate file and reach the preprocess phase only.
"""

import argparse

VIEWS = ("clustering", "conservation", "expression", "structure")

VIEW_HELP = {
    "clustering": "skip the similarity trees (needs GTEx + sequences)",
    "conservation": "skip the ortholog matrix and species tree",
    "expression": "skip the gene x tissue expression matrix",
    "structure": "skip the protein models, topology, and coordinate downloads",
}

DOWNLOADS = ("predicted", "experimental")

DOWNLOAD_HELP = {
    "predicted": "mirror the AlphaFold models instead of streaming them from AlphaFold DB",
    "experimental": "mirror every PDB entry instead of streaming them from RCSB",
}


def build_parser(description: str | None, *, phase_flags: bool = False, hgnc_file: bool = False):
    # allow_abbrev would silently accept a truncated typo like --skip-clusterin
    parser = argparse.ArgumentParser(description=description, allow_abbrev=False)
    for view in VIEWS:
        parser.add_argument(f"--skip-{view}", action="store_true", help=VIEW_HELP[view])
    for kind in DOWNLOADS:
        parser.add_argument(f"--download-{kind}", action="store_true", help=DOWNLOAD_HELP[kind])
    if phase_flags:
        parser.add_argument("--preprocess-only", action="store_true", help="run preprocess only")
        parser.add_argument("--build-only", action="store_true", help="run build only")
    if hgnc_file:
        parser.add_argument(
            "hgnc_file", nargs="?", default="", help="HGNC gene-family TSV (default: raw download)"
        )
    return parser


def parse_args(description: str | None, **kwargs) -> argparse.Namespace:
    return build_parser(description, **kwargs).parse_args()


def skipped_views(args: argparse.Namespace) -> set[str]:
    return {view for view in VIEWS if getattr(args, f"skip_{view}")}


def skip_flags(args: argparse.Namespace) -> list[str]:
    return [f"--skip-{view}" for view in sorted(skipped_views(args))]


def download_flags(args: argparse.Namespace) -> list[str]:
    return [f"--download-{kind}" for kind in DOWNLOADS if getattr(args, f"download_{kind}")]


def preprocess_flags(args: argparse.Namespace) -> list[str]:
    """The build phase copies whatever was mirrored, so --download-* reaches preprocess only."""
    return [*skip_flags(args), *download_flags(args)]
