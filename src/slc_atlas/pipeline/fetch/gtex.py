# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Download the bulk GTEx files and take out the rows for the genes in the dataset.

The TPM matrix is a few gigabytes in size, and a gene family needs a few hundred rows of
it. It is therefore read as text one line at a time, and only the lines that are wanted
are put into a DataFrame.
"""

import gzip
import io
from pathlib import Path

import polars as pl

from ..lib.http import download

BASE = "https://storage.googleapis.com/adult-gtex"
TPM_URL = BASE + "/bulk-gex/{version}/rna-seq/{file}"
ATTRIBUTES_URL = BASE + "/annotations/{version}/metadata-files/{file}"

TPM_FILES = {
    "v8": "GTEx_Analysis_2017-06-05_v8_RNASeQCv1.1.9_gene_tpm.gct.gz",
    "v10": "GTEx_Analysis_v10_RNASeQCv2.4.2_gene_tpm.gct.gz",
    "v11": "GTEx_Analysis_2026-05-19_v11_RNASeQCv2.4.3_gene_tpm.gct.gz",
}
ATTRIBUTES_FILE = "GTEx_Analysis_{version}_Annotations_SampleAttributesDS.txt"

PREAMBLE_LINES = 2  # The "#1.2" version line and the row/column counts


def ensure_tpm(cache_dir: Path, version: str) -> Path:
    return _ensure(TPM_URL.format(version=version, file=TPM_FILES[version]), cache_dir)


def ensure_attributes(cache_dir: Path, version: str) -> Path:
    name = ATTRIBUTES_FILE.format(version=version)
    return _ensure(ATTRIBUTES_URL.format(version=version, file=name), cache_dir)


def _ensure(url: str, cache_dir: Path) -> Path:
    """Download the file unless it is already in the cache, in which case delete it first
    to download it again."""
    path = cache_dir / url.rsplit("/", 1)[-1]
    if not path.exists():
        download(url, path)
    return path


def subset_gct(gct_path: Path, gene_ids: list[str]) -> pl.DataFrame:
    """Return a frame with a gene_id column and one column per sample, keeping the samples
    in the order the GCT file lists them."""
    wanted = set(gene_ids)
    with gzip.open(gct_path, "rt", encoding="utf-8") as handle:
        for _ in range(PREAMBLE_LINES):
            handle.readline()
        kept = [handle.readline()]
        kept.extend(line for line in handle if line.split("\t", 1)[0].split(".")[0] in wanted)

    df = pl.read_csv(io.StringIO("".join(kept)), separator="\t").drop("Description")
    samples = [column for column in df.columns if column != "Name"]
    return df.select(
        pl.col("Name").str.split(".").list.first().alias("gene_id"),
        # Reading the parquet file gives Float32, so both routes hand the build the same type
        *(pl.col(column).cast(pl.Float32) for column in samples),
    )
