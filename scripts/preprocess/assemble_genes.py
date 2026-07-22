# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Join annotation + Ensembl coords + NCBI summaries into dataset/genes.tsv and
dataset/transcripts.tsv (columns mirror the models in backend/app/models/gene.py).

Drops the symbols listed in reference/pseudogene_exclusions.txt and promotes an SLC*
alias to the primary symbol where the HGNC approved symbol isn't SLC*.
"""

import csv
import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.dataset_schema import GENE_SCHEMA, TRANSCRIPT_SCHEMA
from lib.reporting import report_missing

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "backend" / "data"
DEFAULT_ANNOTATION_PATH = DATA_DIR / "raw" / "annotation.tsv"
DEFAULT_ENSEMBL_PATH = DATA_DIR / "raw" / "ensembl_genes.tsv"
DEFAULT_NCBI_PATH = DATA_DIR / "raw" / "ncbi_gene_summaries.tsv"
DEFAULT_GENES_OUT_PATH = DATA_DIR / "dataset" / "genes.tsv"
DEFAULT_TRANSCRIPTS_OUT_PATH = DATA_DIR / "dataset" / "transcripts.tsv"
EXCLUSIONS_PATH = ROOT / "reference" / "pseudogene_exclusions.txt"


def read_exclusions(path: Path) -> frozenset[str]:
    """Approved symbols to drop, one per line; blank lines and #-comments ignored."""
    if not path.exists():
        return frozenset()
    lines = (line.split("#", 1)[0].strip() for line in path.read_text().splitlines())
    return frozenset(line for line in lines if line)


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
    rows: list[dict],
    ensembl_genes: dict,
    ncbi_summaries: dict[str, str],
    exclusions: frozenset[str],
) -> tuple[list[dict], list[dict]]:
    genes = []
    transcripts = []
    skipped = []

    for row in rows:
        if row["Approved symbol"] in exclusions:
            continue
        ensembl_id = row["Ensembl gene ID"]
        egene = ensembl_genes.get(ensembl_id)
        if egene is None:
            skipped.append(row["Approved symbol"])
            continue

        approved = row["Approved symbol"]
        alias_raw = row["Alias symbols"].strip()
        alias_parts = [a.strip() for a in alias_raw.split(",") if a.strip()] if alias_raw else []

        slc_aliases = [a for a in alias_parts if a.startswith("SLC")]
        if not approved.startswith("SLC") and slc_aliases:
            symbol = slc_aliases[0]
            remaining = [a for a in alias_parts if a != slc_aliases[0]]
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

    report_missing("gene(s) skipped (no Ensembl lookup result)", skipped)
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

    exclusions = read_exclusions(EXCLUSIONS_PATH)
    genes, transcripts = build_tables(rows, ensembl_genes, ncbi_summaries, exclusions)

    Path(genes_out_path).parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(genes, schema=GENE_SCHEMA).write_csv(genes_out_path, separator="\t")
    pl.DataFrame(transcripts, schema=TRANSCRIPT_SCHEMA).write_csv(
        transcripts_out_path, separator="\t"
    )


if __name__ == "__main__":
    main()
