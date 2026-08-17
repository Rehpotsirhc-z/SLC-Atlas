# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Join the annotation, the Ensembl coordinates and the NCBI summaries together, and write
them out as source/genes.tsv and source/transcripts.tsv, whose columns are the ones the
models in src/slc_atlas/models/gene.py describe.

Any symbol listed in the curated exclusions.txt is left out. Where symbol_overrides.tsv
gives a display symbol for a gene, that symbol is shown instead of the approved symbol
HGNC lists.
"""

import csv
from pathlib import Path

import polars as pl

from ..lib.reporting import NOTE, report_missing
from ..lib.source_schema import GENE_SCHEMA, TRANSCRIPT_SCHEMA
from . import curation


def read_annotation_rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_ensembl_genes(path: Path) -> dict[str, dict]:
    """Group BioMart's TSV, which has one row per transcript, into one entry per gene."""
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


def read_ncbi_summaries(path: Path) -> dict[str, str]:
    with open(path, encoding="utf-8") as f:
        return {row["NCBI Gene ID"]: row["Summary"] for row in csv.DictReader(f, delimiter="\t")}


def build_tables(
    rows: list[dict],
    ensembl_genes: dict,
    ncbi_summaries: dict[str, str],
    exclusions: frozenset[str],
    overrides: dict[str, str],
) -> tuple[list[dict], list[dict]]:
    genes = []
    transcripts = []
    skipped = []
    excluded = []
    promoted = []

    for row in rows:
        if row["Approved symbol"] in exclusions:
            excluded.append(row["Approved symbol"])
            continue
        ensembl_id = row["Ensembl gene ID"]
        egene = ensembl_genes.get(ensembl_id)
        if egene is None:
            skipped.append(row["Approved symbol"])
            continue

        approved = row["Approved symbol"]
        alias_raw = row["Alias symbols"].strip()
        alias_parts = [a.strip() for a in alias_raw.split(",") if a.strip()] if alias_raw else []

        display = overrides.get(ensembl_id)
        if display:
            promoted.append(f"{approved} shown as {display}")
            symbol = display
            remaining = [a for a in alias_parts if a != display]
            alias_out = ", ".join([approved] + remaining) or None
        else:
            symbol = approved
            alias_out = alias_raw or None

        genes.append(
            {
                "id": ensembl_id,
                "symbol": symbol,
                "name": row["Approved name"],
                "chromosome": egene["chromosome"],
                "start": egene["start"],
                "end": egene["end"],
                "strand": "+" if egene["strand"] == 1 else "-",
                "length": egene["end"] - egene["start"] + 1,
                "alias": alias_out,
                "category": row["Functional family"].strip() or row["Group name"].strip(),
                "family": row["Family"].strip(),
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

    report_missing("gene", "skipped, with no result from Ensembl", skipped)
    report_missing("gene", "left out by exclusions.txt", excluded, severity=NOTE, checked=len(rows))
    report_missing("gene", "shown under an alias by symbol_overrides.tsv", promoted, severity=NOTE)
    return genes, transcripts


def run(
    annotation_path: Path,
    ensembl_path: Path,
    ncbi_path: Path,
    exclusions_path: Path,
    symbol_overrides_path: Path,
    genes_out: Path,
    transcripts_out: Path,
) -> None:
    rows = read_annotation_rows(annotation_path)
    ensembl_genes = read_ensembl_genes(ensembl_path)
    ncbi_summaries = read_ncbi_summaries(ncbi_path)

    genes, transcripts = build_tables(
        rows,
        ensembl_genes,
        ncbi_summaries,
        curation.read_exclusions(exclusions_path),
        curation.read_symbol_overrides(symbol_overrides_path),
    )

    genes_out.parent.mkdir(parents=True, exist_ok=True)
    transcripts_out.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(genes, schema=GENE_SCHEMA).write_csv(genes_out, separator="\t")
    pl.DataFrame(transcripts, schema=TRANSCRIPT_SCHEMA).write_csv(transcripts_out, separator="\t")
