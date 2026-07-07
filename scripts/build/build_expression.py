# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build expression.parquet (gene x tissue mean-TPM matrix) from the dataset.

Two tissue scopes are precomputed from the sample-level GTEx TPM matrix:
  all   -> mean TPM per (gene, tissue)
  brain -> mean TPM per (gene, tissue_detail) within tissue == "Brain"
"""

import sys
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
DATASET_DIR = DATA_DIR / "dataset"
EXPRESSION_PATH = DATASET_DIR / "expression.parquet"
TISSUE_PATH = DATASET_DIR / "sample_tissue.tsv"
GENES_PATH = DATASET_DIR / "genes.tsv"
EXPRESSION_OUT = DATA_DIR / "expression.parquet"

EXPRESSION_SCHEMA = {
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "family": pl.Utf8,
    "tissue": pl.Utf8,
    "tissue_scope": pl.Utf8,
    "tpm": pl.Float64,
}


def melt_samples() -> pl.LazyFrame:
    wide = pl.scan_parquet(EXPRESSION_PATH)
    sample_cols = [c for c in wide.collect_schema().names() if c != "gene_id"]
    return wide.unpivot(
        on=sample_cols, index="gene_id", variable_name="sample_id", value_name="tpm"
    )


def build_expression() -> pl.DataFrame:
    long = melt_samples()
    tissue = pl.scan_csv(TISSUE_PATH, separator="\t")
    genes = (
        pl.scan_csv(GENES_PATH, separator="\t")
        .select("id", "symbol", "family")
        .rename({"id": "gene_id"})
    )

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


def main() -> None:
    df = build_expression()
    df.write_parquet(EXPRESSION_OUT)

    for scope in ("all", "brain"):
        scoped = df.filter(pl.col("tissue_scope") == scope)
        n_genes = scoped["gene_id"].n_unique()
        n_tissues = scoped["tissue"].n_unique()
        print(
            f"wrote {len(scoped)} '{scope}' rows ({n_genes} genes x {n_tissues} tissues) -> {EXPRESSION_OUT}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
