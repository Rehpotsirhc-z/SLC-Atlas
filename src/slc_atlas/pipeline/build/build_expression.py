# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build expression.parquet, which holds the mean TPM of each gene in each tissue.

The GTEx matrix has a value per sample, and the means are worked out twice over. The
matrix for all tissues averages the samples of each tissue, and the matrix for the brain
takes only the samples whose tissue is the brain and averages them by the more detailed
tissue each one came from.
"""

from pathlib import Path

import polars as pl

from ..lib import parquet
from ..lib import console

from ..lib.reporting import report_missing

EXPRESSION_SCHEMA = {
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "family": pl.Utf8,
    "tissue": pl.Utf8,
    "tissue_scope": pl.Utf8,
    "tpm": pl.Float64,
}


def melt_samples(expression_path: Path) -> pl.LazyFrame:
    wide = pl.scan_parquet(expression_path)
    sample_cols = [c for c in wide.collect_schema().names() if c != "gene_id"]
    return wide.unpivot(
        on=sample_cols, index="gene_id", variable_name="sample_id", value_name="tpm"
    )


def _report_unmatched(long: pl.LazyFrame, tissue: pl.LazyFrame, genes: pl.LazyFrame) -> None:
    """Report genes and samples that the joins will omit."""
    measured = long.select("gene_id").unique()
    report_missing(
        "gene",
        "missing from the GTEx matrix and omitted from the Expression view",
        genes.join(measured, on="gene_id", how="anti").collect()["gene_id"].to_list(),
        clean="every gene has a row in the GTEx matrix",
    )
    report_missing(
        "sample",
        "missing from sample_tissue.tsv and omitted from the Expression view",
        long.select("sample_id")
        .unique()
        .join(tissue, on="sample_id", how="anti")
        .collect()["sample_id"]
        .to_list(),
    )


def build_expression(source_dir: Path) -> pl.DataFrame:
    long = melt_samples(source_dir / "expression.parquet")
    tissue = pl.scan_csv(source_dir / "sample_tissue.tsv", separator="\t")
    genes = (
        pl.scan_csv(source_dir / "genes.tsv", separator="\t")
        .select("id", "symbol", "family")
        .rename({"id": "gene_id"})
    )

    _report_unmatched(long, tissue, genes)
    long = long.join(tissue, on="sample_id", how="inner").join(genes, on="gene_id", how="inner")

    all_scope = (
        long.group_by("gene_id", "symbol", "family", "tissue")
        .agg(pl.col("tpm").mean())
        .with_columns(tissue_scope=pl.lit("all"))
    )
    brain_scope = (
        long.filter(pl.col("tissue") == "Brain")
        .group_by("gene_id", "symbol", "family", tissue=pl.col("tissue_detail"))
        .agg(pl.col("tpm").mean())
        .with_columns(tissue_scope=pl.lit("brain"))
    )

    return (
        pl.concat([all_scope, brain_scope])
        .select(*EXPRESSION_SCHEMA)
        .collect()
        .cast(EXPRESSION_SCHEMA)
    )


def run(source_dir: Path, out_dir: Path) -> None:
    expression_out = out_dir / "expression.parquet"

    df = build_expression(source_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    parquet.write(df, expression_out)

    for scope in ("all", "brain"):
        scoped = df.filter(pl.col("tissue_scope") == scope)
        n_genes = scoped["gene_id"].n_unique()
        n_tissues = scoped["tissue"].n_unique()
        console.success(f"Wrote {len(scoped)} '{scope}' rows, {n_genes} genes across {n_tissues} tissues "
            f"-> {expression_out}")
