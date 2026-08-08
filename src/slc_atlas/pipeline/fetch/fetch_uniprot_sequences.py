# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the UniProt canonical sequence of every accession the structure view uses.

The residues plot writes the one-letter code of a residue inside its bead, so it needs the
sequence that the features are numbered against. The accessions are read from
uniprot_map.tsv rather than being worked out again, so that this step cannot end up with
different accessions from the ones the other structure files were built with.
"""

import sys
from pathlib import Path

import polars as pl

from ..lib.reporting import report_missing
from .fetch_uniprot_map import fetch_entries

SCHEMA = {
    "gene_id": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "sequence": pl.Utf8,
}


def run(map_path: Path, out_path: Path) -> None:
    gene_map = pl.read_csv(map_path, separator="\t").drop_nulls("uniprot_accession")
    accessions = sorted(set(gene_map["uniprot_accession"]))
    print(f"fetching sequences for {len(accessions)} accessions...", file=sys.stderr)
    entries = fetch_entries(accessions)

    rows = [
        {
            "gene_id": row["gene_id"],
            "uniprot_accession": row["uniprot_accession"],
            "sequence": entries.get(row["uniprot_accession"], {}).get("sequence"),
        }
        for row in gene_map.iter_rows(named=True)
    ]

    report_missing(
        "gene", "with no canonical sequence", [r["gene_id"] for r in rows if not r["sequence"]]
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows, schema=SCHEMA).write_csv(out_path, separator="\t")

    covered = sum(1 for r in rows if r["sequence"])
    residues = sum(len(r["sequence"]) for r in rows if r["sequence"])
    print(f"wrote {covered}/{len(rows)} genes, {residues} residues -> {out_path}", file=sys.stderr)
