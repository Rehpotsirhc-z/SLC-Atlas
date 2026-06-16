# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Join SLC_annotation.tsv with the cached Ensembl + NCBI lookups into
genes.parquet and transcripts.parquet, matching the Gene/Transcript models
in backend/app/models/gene.py.

Usage:
    python scripts/build_gene_tables.py [SLC_annotation.tsv] [ensembl_genes.tsv] \\
        [ncbi_gene_summaries.tsv] [genes.parquet] [transcripts.parquet]

Defaults to backend/data/SLC_annotation.tsv, backend/data/raw/ensembl_genes.tsv,
backend/data/raw/ncbi_gene_summaries.tsv, backend/data/genes.parquet, and
backend/data/transcripts.parquet.
"""

import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

import polars as pl

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DEFAULT_ANNOTATION_PATH = DATA_DIR / "SLC_annotation.tsv"
DEFAULT_ENSEMBL_PATH = DATA_DIR / "raw" / "ensembl_genes.tsv"
DEFAULT_NCBI_PATH = DATA_DIR / "raw" / "ncbi_gene_summaries.tsv"
DEFAULT_GENES_OUT_PATH = DATA_DIR / "genes.parquet"
DEFAULT_TRANSCRIPTS_OUT_PATH = DATA_DIR / "transcripts.parquet"

GENE_SCHEMA = {
    "id": pl.Utf8,
    "symbol": pl.Utf8,
    "name": pl.Utf8,
    "chromosome": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "strand": pl.Utf8,
    "length": pl.Int64,
    "alias": pl.Utf8,
    "category": pl.Utf8,
    "family": pl.Utf8,
    "family_name": pl.Utf8,
    "function_brief": pl.Utf8,
}

FAMILY_RE = re.compile(r"^Solute carrier family (\d+)(?:,.*)?$")
ORGANIC_ANION_GROUP_NAME = "Solute carrier organic anion transporter family"


def derive_family(group_name: str) -> str:
    m = FAMILY_RE.match(group_name)
    if m:
        return f"SLC{m.group(1)}"
    if group_name == ORGANIC_ANION_GROUP_NAME:
        return "SLCO"
    raise ValueError(f"Unrecognized HGNC group name: {group_name!r}")


def backfill_categories(genes: list[dict]) -> None:
    """Fill in a null category from sibling family members, but only when
    every other categorized member of the family agrees on a single value.
    Families with multiple distinct subfamily descriptions (e.g. SLC35's
    lettered subfamilies) are left alone."""
    category_values_by_family: dict[str, set[str]] = defaultdict(set)
    for gene in genes:
        if gene["category"] is not None:
            category_values_by_family[gene["family"]].add(gene["category"])

    for gene in genes:
        if gene["category"] is None:
            candidates = category_values_by_family.get(gene["family"], set())
            if len(candidates) == 1:
                gene["category"] = next(iter(candidates))


TRANSCRIPT_SCHEMA = {
    "id": pl.Utf8,
    "gene_id": pl.Utf8,
    "name": pl.Utf8,
    "type": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "length": pl.Int64,
}


def read_annotation_rows(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_ensembl_genes(path: str) -> dict[str, dict]:
    """Group BioMart's one-row-per-transcript TSV into one entry per gene."""
    genes: dict[str, dict] = {}
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            gene_id = row["Gene stable ID"]
            gene = genes.setdefault(
                gene_id,
                {
                    "chromosome": row["Chromosome/scaffold name"],
                    "start": int(row["Gene start (bp)"]),
                    "end": int(row["Gene end (bp)"]),
                    "strand": int(row["Strand"]),
                    "transcripts": [],
                },
            )
            gene["transcripts"].append(
                {
                    "id": row["Transcript stable ID"],
                    "name": row["Transcript name"],
                    "type": row["Transcript type"],
                    "start": int(row["Transcript start (bp)"]),
                    "end": int(row["Transcript end (bp)"]),
                    "length": int(row["Transcript length (including UTRs and CDS)"]),
                }
            )
    return genes


def read_ncbi_summaries(path: str) -> dict[str, str]:
    with open(path, encoding="utf-8") as f:
        return {row["NCBI Gene ID"]: row["Summary"] for row in csv.DictReader(f, delimiter="\t")}


def build_tables(
    rows: list[dict], ensembl_genes: dict, ncbi_summaries: dict[str, str]
) -> tuple[list[dict], list[dict]]:
    genes = []
    transcripts = []
    skipped = []

    for row in rows:
        ensembl_id = row["Ensembl gene ID"]
        egene = ensembl_genes.get(ensembl_id)
        if egene is None:
            skipped.append(row["Approved symbol"])
            continue

        genes.append(
            {
                "id": ensembl_id,
                "symbol": row["Approved symbol"],
                "name": row["Approved name"],
                "chromosome": egene["chromosome"],
                "start": egene["start"],
                "end": egene["end"],
                "strand": "+" if egene["strand"] == 1 else "-",
                "length": egene["end"] - egene["start"] + 1,
                "alias": row["Alias symbols"].strip() or None,
                "category": row["Functional family"].strip() or None,
                "family": derive_family(row["Group name"].strip()),
                "family_name": row["Group name"].strip(),
                "function_brief": ncbi_summaries.get(row["NCBI Gene ID"], "").strip() or None,
            }
        )

        for etranscript in egene["transcripts"]:
            transcripts.append(
                {
                    "id": etranscript["id"],
                    "gene_id": ensembl_id,
                    "name": etranscript["name"],
                    "type": etranscript["type"],
                    "start": etranscript["start"],
                    "end": etranscript["end"],
                    "length": etranscript["length"],
                }
            )

    if skipped:
        print(f"{len(skipped)} gene(s) skipped (no Ensembl lookup result):", file=sys.stderr)
        for symbol in skipped:
            print(f"  {symbol}", file=sys.stderr)

    backfill_categories(genes)

    return genes, transcripts


def main() -> None:
    args = sys.argv[1:]
    annotation_path = args[0] if len(args) > 0 else DEFAULT_ANNOTATION_PATH
    ensembl_path = args[1] if len(args) > 1 else DEFAULT_ENSEMBL_PATH
    ncbi_path = args[2] if len(args) > 2 else DEFAULT_NCBI_PATH
    genes_out_path = args[3] if len(args) > 3 else DEFAULT_GENES_OUT_PATH
    transcripts_out_path = args[4] if len(args) > 4 else DEFAULT_TRANSCRIPTS_OUT_PATH

    rows = read_annotation_rows(annotation_path)
    ensembl_genes = read_ensembl_genes(ensembl_path)
    ncbi_summaries = read_ncbi_summaries(ncbi_path)

    genes, transcripts = build_tables(rows, ensembl_genes, ncbi_summaries)

    pl.DataFrame(genes, schema=GENE_SCHEMA).write_parquet(genes_out_path)
    pl.DataFrame(transcripts, schema=TRANSCRIPT_SCHEMA).write_parquet(transcripts_out_path)


if __name__ == "__main__":
    main()
