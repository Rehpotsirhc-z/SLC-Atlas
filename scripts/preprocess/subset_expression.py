# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Subset the raw GTEx gene-TPM matrix to the dataset genes and capture the
sample -> tissue map for the RNA co-expression trees.

Strips the Ensembl version suffix from the GTEx `Name`, and normalizes the sample
attribute columns (SAMPID/SMTS/SMTSD) to sample_id/tissue/tissue_detail.
"""

import sys
import urllib.request
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
RAW_DIR = DATA_DIR / "raw"
DATASET_DIR = DATA_DIR / "dataset"
DEFAULT_GENES_PATH = DATASET_DIR / "genes.tsv"
DEFAULT_GTEX_PATH = RAW_DIR / "GTEx_Analysis_2026-05-19_v11_RNASeQCv2.4.3_gene_tpm.parquet"
DEFAULT_TPM_OUT = DATASET_DIR / "expression.parquet"
DEFAULT_TISSUE_OUT = DATASET_DIR / "sample_tissue.tsv"

ATTRIBUTES_URL = (
    "https://storage.googleapis.com/adult-gtex/annotations/v11/metadata-files/"
    "GTEx_Analysis_v11_Annotations_SampleAttributesDS.txt"
)
DEFAULT_ATTRIBUTES_PATH = RAW_DIR / "GTEx_v11_SampleAttributesDS.txt"


def subset_tpm(genes_path: Path, gtex_path: Path) -> pl.DataFrame:
    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()
    df = (
        pl.scan_parquet(gtex_path)
        .with_columns(pl.col("Name").str.split(".").list.first().alias("gene_id"))
        .filter(pl.col("gene_id").is_in(gene_ids))
        .drop("Name", "Description")
        .collect(engine="streaming")
    )
    cols = ["gene_id"] + [c for c in df.columns if c != "gene_id"]
    df = df.select(cols)
    found = df.height
    print(f"{found}/{len(gene_ids)} genes found in GTEx", file=sys.stderr)
    if found < len(gene_ids):
        missing = sorted(set(gene_ids) - set(df["gene_id"].to_list()))
        print(f"{len(missing)} not in GTEx (e.g. {missing[:5]})", file=sys.stderr)
    return df


def build_tissue_map(attributes_path: Path) -> pl.DataFrame:
    """Normalize the GTEx sample attributes to sample_id, tissue, tissue_detail."""
    if not attributes_path.exists():
        print(f"downloading {ATTRIBUTES_URL}", file=sys.stderr)
        urllib.request.urlretrieve(ATTRIBUTES_URL, attributes_path)
    return pl.read_csv(attributes_path, separator="\t", infer_schema_length=0).select(
        sample_id=pl.col("SAMPID"), tissue=pl.col("SMTS"), tissue_detail=pl.col("SMTSD")
    )


def main() -> None:
    args = sys.argv[1:]
    genes_path = Path(args[0]) if len(args) > 0 else DEFAULT_GENES_PATH
    gtex_path = Path(args[1]) if len(args) > 1 else DEFAULT_GTEX_PATH
    tpm_out = Path(args[2]) if len(args) > 2 else DEFAULT_TPM_OUT
    tissue_out = Path(args[3]) if len(args) > 3 else DEFAULT_TISSUE_OUT

    tpm_out.parent.mkdir(parents=True, exist_ok=True)
    tpm = subset_tpm(genes_path, gtex_path)
    tpm.write_parquet(tpm_out)

    tissue = build_tissue_map(DEFAULT_ATTRIBUTES_PATH)
    sample_cols = set(tpm.columns) - {"gene_id"}
    tissue = tissue.filter(pl.col("sample_id").is_in(list(sample_cols)))
    n_brain = tissue.filter(pl.col("tissue") == "Brain").height
    print(f"{tissue.height} samples mapped to tissue ({n_brain} brain)", file=sys.stderr)
    tissue.write_csv(tissue_out, separator="\t")


if __name__ == "__main__":
    main()
