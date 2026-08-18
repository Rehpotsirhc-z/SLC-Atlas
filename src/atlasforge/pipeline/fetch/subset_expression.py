# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Take the rows for the dataset's genes out of the downloaded GTEx TPM matrix, and record
which tissue each sample came from, which the RNA co-expression trees need.

The version suffix is removed from the Ensembl gene id in the GTEx Name column, and the
SAMPID, SMTS and SMTSD sample attribute columns are renamed to sample_id, tissue and
tissue_detail.
"""

from pathlib import Path

import polars as pl

from ..lib import console

from ..lib.reporting import report_missing


def subset_tpm(gene_ids: list[str], gtex_path: Path) -> pl.DataFrame:
    df = (
        pl.scan_parquet(gtex_path)
        .with_columns(pl.col("Name").str.split(".").list.first().alias("gene_id"))
        .filter(pl.col("gene_id").is_in(gene_ids))
        .drop("Name", "Description")
        .collect(engine="streaming")
    )
    cols = ["gene_id"] + [c for c in df.columns if c != "gene_id"]
    return df.select(cols)


def build_tissue_map(attributes_path: Path) -> pl.DataFrame:
    """Read the GTEx sample attributes and rename its columns to sample_id, tissue and
    tissue_detail."""
    return pl.read_csv(attributes_path, separator="\t", infer_schema_length=0).select(
        sample_id=pl.col("SAMPID"), tissue=pl.col("SMTS"), tissue_detail=pl.col("SMTSD")
    )


def run(
    genes_path: Path, gtex_path: Path, attributes_path: Path, tpm_out: Path, tissue_out: Path
) -> None:
    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()
    if gtex_path.suffix == ".parquet":
        tpm = subset_tpm(gene_ids, gtex_path)
    else:
        from . import gtex

        tpm = gtex.subset_gct(gtex_path, gene_ids)

    console.detail(f"{tpm.height}/{len(gene_ids)} genes found in GTEx")
    report_missing(
        "gene", "not in the GTEx matrix", sorted(set(gene_ids) - set(tpm["gene_id"].to_list()))
    )
    tpm_out.parent.mkdir(parents=True, exist_ok=True)
    tpm.write_parquet(tpm_out)

    tissue = build_tissue_map(attributes_path)
    sample_cols = set(tpm.columns) - {"gene_id"}
    tissue = tissue.filter(pl.col("sample_id").is_in(list(sample_cols)))
    n_brain = tissue.filter(pl.col("tissue") == "Brain").height
    console.detail(f"{tissue.height} samples mapped to tissue ({n_brain} brain)")
    tissue_out.parent.mkdir(parents=True, exist_ok=True)
    tissue.write_csv(tissue_out, separator="\t")
