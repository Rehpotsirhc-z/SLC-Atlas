# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Validate structure data before building the view."""

from pathlib import Path

import polars as pl

from ...config import COMMAND_NAME
from ..lib.reporting import NOTE, WARN, count, report_missing

STEP_FOR = {
    "uniprot_map.tsv": "fetch_uniprot_map",
    "features.tsv": "fetch_protein_features",
    "structures.tsv": "fetch_structures",
    "experimental.tsv": "fetch_structures",
}

PER_RESIDUE = [("plddt", "plddt_accession"), ("sequence", "sequence_accession")]


def check_columns(path: Path, schema: dict) -> None:
    """Report columns missing from an older source file."""
    header = path.read_text(encoding="utf-8").split("\n", 1)[0].rstrip("\r").split("\t")
    missing = [column for column in schema if column not in header]
    if not missing:
        return
    raise SystemExit(
        f"{path} is missing {count('column', len(missing))} this version expects: "
        f"{', '.join(missing)}.\nIt was written by an older version of the pipeline. Fetch it "
        f"again with `{COMMAND_NAME} fetch --step {STEP_FOR.get(path.name, 'fetch_structures')}`."
    )


def drop_stale(df: pl.DataFrame) -> pl.DataFrame:
    """Drop per-residue data fetched for a different UniProt accession."""
    for column, accession in PER_RESIDUE:
        stale = pl.col(accession).is_null() | (pl.col(accession) != pl.col("uniprot_accession"))
        report_missing(
            "gene",
            f"whose {column} was fetched for a different accession, so the {column} was dropped",
            df.filter(pl.col(column).is_not_null() & stale)
            .select(
                pl.format(
                    "{} {}: fetched for {}, currently {}",
                    "symbol",
                    "gene_id",
                    accession,
                    "uniprot_accession",
                )
            )
            .to_series()
            .to_list(),
        )
        df = df.with_columns(pl.when(stale).then(None).otherwise(pl.col(column)).alias(column))
    return drop_misnumbered(df).drop(accession for _, accession in PER_RESIDUE)


def drop_misnumbered(df: pl.DataFrame) -> pl.DataFrame:
    """Drop confidence arrays whose length does not match the protein."""
    wrong = pl.col("plddt").is_not_null() & (pl.col("plddt").list.len() != pl.col("uniprot_length"))
    report_missing(
        "gene",
        "whose confidence scores are not as long as the protein, so they were dropped",
        df.filter(wrong)
        .select(
            pl.format(
                "{} {}: {} scores against {} residues",
                "symbol",
                "gene_id",
                pl.col("plddt").list.len(),
                "uniprot_length",
            )
        )
        .to_series()
        .to_list(),
    )
    return df.with_columns(pl.when(wrong).then(None).otherwise(pl.col("plddt")).alias("plddt"))


def report_models(structure: pl.DataFrame, mirrored: int) -> None:
    """Say what the structure view will and will not be able to show."""
    with_model = structure.filter(pl.col("afdb_entry_id").is_not_null())
    report_missing(
        "gene",
        "whose predicted model is built from a sequence other than the UniProt canonical, so "
        "the figure and the 3D viewer cannot be indexed against each other",
        with_model.filter(~pl.col("model_is_canonical"))["gene_id"].to_list(),
        checked=with_model.height,
        clean="every predicted model is built from the UniProt canonical sequence",
    )
    absent = structure.filter(pl.col("afdb_entry_id").is_not_null() & ~pl.col("model_available"))
    report_missing(
        "gene",
        "whose model file is not mirrored here, so the viewer streams it from AlphaFold",
        absent["gene_id"].to_list(),
        severity=WARN if mirrored else NOTE,
    )
