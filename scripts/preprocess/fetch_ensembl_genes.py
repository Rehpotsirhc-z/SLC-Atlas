# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch gene + transcript coordinates from Ensembl BioMart in one bulk query.

Caches the raw TSV response (one row per transcript, gene fields repeated).

The regional mirrors serve the same data, so a host in maintenance falls through to the
next rather than failing the run.
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import post_form
from lib.reporting import report_missing

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
DEFAULT_IN_PATH = DATA_DIR / "raw" / "annotation.tsv"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "ensembl_genes.tsv"

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
        # A mirror in maintenance answers 200 with an HTML status page
        if tsv.lstrip().startswith("<") or "Query ERROR" in tsv[:2000]:
            failures.append(f"{url}: not a BioMart result")
            continue
        if url != BIOMART_MIRRORS[0]:
            print(f"BioMart served by {url}", file=sys.stderr)
        return tsv
    raise RuntimeError("no BioMart mirror answered:\n  " + "\n  ".join(failures))


def main() -> None:
    args = sys.argv[1:]
    in_path = args[0] if len(args) > 0 else DEFAULT_IN_PATH
    out_path = args[1] if len(args) > 1 else DEFAULT_OUT_PATH

    ids = read_ensembl_ids(in_path)
    tsv = fetch_biomart(ids)

    rows = [line for line in tsv.splitlines() if line]
    returned_genes = {line.split("\t")[0] for line in rows[1:]}
    report_missing("Ensembl ID(s) had no match", [i for i in ids if i not in returned_genes])

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(tsv)


if __name__ == "__main__":
    main()
