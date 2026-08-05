# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the UniProt canonical sequence for every accession the structure view maps to.

The snake plot puts a residue's one-letter code inside its bead, so it needs the sequence
the features are numbered against. Accessions come from uniprot_map.tsv rather than being
resolved again, which keeps this step from moving a dataset the other structure files were
already built against.
"""

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fetch_uniprot_map import fetch_entries

from lib.reporting import report_missing

STRUCTURE_DIR = Path(__file__).resolve().parents[2] / "backend" / "data" / "dataset" / "structure"
DEFAULT_MAP_PATH = STRUCTURE_DIR / "uniprot_map.tsv"
DEFAULT_OUT_PATH = STRUCTURE_DIR / "sequences.tsv"

SCHEMA = {
    "gene_id": pl.Utf8,
    "uniprot_accession": pl.Utf8,
    "sequence": pl.Utf8,
}


def main() -> None:
    args = sys.argv[1:]
    map_path = Path(args[0]) if len(args) > 0 else DEFAULT_MAP_PATH
    out_path = Path(args[1]) if len(args) > 1 else DEFAULT_OUT_PATH

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

    report_missing("gene(s) with no canonical sequence",
                   [r["gene_id"] for r in rows if not r["sequence"]])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows, schema=SCHEMA).write_csv(out_path, separator="\t")

    covered = sum(1 for r in rows if r["sequence"])
    residues = sum(len(r["sequence"]) for r in rows if r["sequence"])
    print(f"wrote {covered}/{len(rows)} genes, {residues} residues -> {out_path}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
