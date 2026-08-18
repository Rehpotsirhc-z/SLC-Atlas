# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the gene and transcript coordinates from Ensembl BioMart in a single query.

The TSV that BioMart returns is cached exactly as it arrives, with one row per transcript
and the gene fields repeated on each of them.

The regional mirrors all serve the same data, so a mirror that is down for maintenance
means trying the next one rather than failing the whole run.
"""

import csv
from pathlib import Path

from ..lib import console
from ..lib.http import post_form
from ..lib.reporting import report_missing

BIOMART_MIRRORS = (
    "https://www.ensembl.org/biomart/martservice",
    "https://asia.ensembl.org/biomart/martservice",
    "https://useast.ensembl.org/biomart/martservice",
)

QUERY_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="default" formatter="TSV" header="1" uniqueRows="1" count="" datasetConfigVersion="0.6">
  <Dataset name="hsapiens_gene_ensembl" interface="default">
    <Filter name="ensembl_gene_id" value="{ids}"/>
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="chromosome_name"/>
    <Attribute name="start_position"/>
    <Attribute name="end_position"/>
    <Attribute name="strand"/>
    <Attribute name="ensembl_transcript_id"/>
    <Attribute name="transcript_start"/>
    <Attribute name="transcript_end"/>
    <Attribute name="transcript_length"/>
    <Attribute name="transcript_biotype"/>
    <Attribute name="external_transcript_name"/>
  </Dataset>
</Query>"""


def read_ensembl_ids(path: str | Path) -> list[str]:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return [row["Ensembl gene ID"] for row in reader if row["Ensembl gene ID"].strip()]


def fetch_biomart(ids: list[str]) -> str:
    query = QUERY_TEMPLATE.format(ids=",".join(ids))
    failures = []
    for url in BIOMART_MIRRORS:
        try:
            tsv = post_form(url, {"query": query})
        except Exception as exc:
            failures.append(f"{url}: {exc}")
            continue
        # A mirror that is down for maintenance answers 200 with an HTML status page
        if tsv.lstrip().startswith("<") or "Query ERROR" in tsv[:2000]:
            failures.append(f"{url}: not a BioMart result")
            continue
        if url != BIOMART_MIRRORS[0]:
            console.detail(f"BioMart served by {url}")
        return tsv
    raise RuntimeError("no BioMart mirror answered:\n  " + "\n  ".join(failures))


def run(annotation_path: Path, out_path: Path) -> None:
    ids = read_ensembl_ids(annotation_path)
    tsv = fetch_biomart(ids)

    rows = [line for line in tsv.splitlines() if line]
    returned_genes = {line.split("\t")[0] for line in rows[1:]}
    report_missing(
        "Ensembl gene id", "with no match at Ensembl", [i for i in ids if i not in returned_genes]
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(tsv)
