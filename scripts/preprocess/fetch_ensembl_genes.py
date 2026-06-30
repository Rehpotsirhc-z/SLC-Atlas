# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch gene + transcript coordinates from Ensembl BioMart in one bulk query.

Caches the raw TSV response (one row per transcript, gene fields repeated).
"""

import csv
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
DEFAULT_IN_PATH = DATA_DIR / "raw" / "annotation.tsv"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "ensembl_genes.tsv"

BIOMART_URL = "https://www.ensembl.org/biomart/martservice"

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


def read_ensembl_ids(path: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return [row["Ensembl gene ID"] for row in reader if row["Ensembl gene ID"].strip()]


def fetch_biomart(ids: list[str]) -> str:
    query = QUERY_TEMPLATE.format(ids=",".join(ids))
    body = urllib.parse.urlencode({"query": query}).encode("utf-8")
    with urllib.request.urlopen(BIOMART_URL, data=body, timeout=60) as resp:
        return resp.read().decode("utf-8")


def main() -> None:
    args = sys.argv[1:]
    in_path = args[0] if len(args) > 0 else DEFAULT_IN_PATH
    out_path = args[1] if len(args) > 1 else DEFAULT_OUT_PATH

    ids = read_ensembl_ids(in_path)
    tsv = fetch_biomart(ids)

    rows = [line for line in tsv.splitlines() if line]
    returned_genes = {line.split("\t")[0] for line in rows[1:]}
    missing = [id_ for id_ in ids if id_ not in returned_genes]
    if missing:
        print(f"{len(missing)} Ensembl ID(s) had no match:", file=sys.stderr)
        for id_ in missing:
            print(f"  {id_}", file=sys.stderr)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(tsv)


if __name__ == "__main__":
    main()
