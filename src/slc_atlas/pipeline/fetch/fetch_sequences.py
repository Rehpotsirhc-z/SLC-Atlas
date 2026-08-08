# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the coding and the protein sequence of each gene from the Ensembl REST API.

Both sequences are taken from the same canonical transcript, so that the DNA tree and the
amino-acid tree can be compared with each other.
"""

import sys
import time
from pathlib import Path

import polars as pl

from ..lib.http import post_json
from ..lib.reporting import report_missing

REST = "https://rest.ensembl.org"
LOOKUP_BATCH = 1000  # The most ids /lookup/id accepts in one request
SEQUENCE_BATCH = 50  # The most ids /sequence/id accepts in one request


def resolve_canonical(gene_ids: list[str]) -> dict[str, str]:
    """Return the id of the canonical transcript of each gene, keyed by gene id. The
    version suffix is removed because /sequence/id answers 404 for a versioned id."""
    mapping: dict[str, str] = {}
    for i in range(0, len(gene_ids), LOOKUP_BATCH):
        chunk = gene_ids[i : i + LOOKUP_BATCH]
        result = post_json(f"{REST}/lookup/id", {"ids": chunk})
        for gid in chunk:
            info = result.get(gid)
            if not info or not info.get("canonical_transcript"):
                print(f"  no canonical transcript: {gid}", file=sys.stderr)
                continue
            mapping[gid] = info["canonical_transcript"].split(".")[0]
    return mapping


def fetch_sequences(tx_to_gene: dict[str, str], seq_type: str) -> dict[str, str]:
    """Return the sequence of the given Ensembl sequence type for each gene, keyed by gene
    id."""
    out: dict[str, str] = {}
    tx_ids = list(tx_to_gene)
    for i in range(0, len(tx_ids), SEQUENCE_BATCH):
        chunk = tx_ids[i : i + SEQUENCE_BATCH]
        records = post_json(f"{REST}/sequence/id?type={seq_type}", {"ids": chunk})
        for rec in records:
            tx = rec.get("query") or rec.get("id")
            gene_id = tx_to_gene.get(tx)
            seq = rec.get("seq")
            if gene_id and seq:
                out[gene_id] = seq
        time.sleep(0.2)  # Stay well under Ensembl's limit of 15 requests a second
    return out


def write_fasta(path: Path, sequences: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for gene_id, seq in sequences.items():
            f.write(f">{gene_id}\n")
            for j in range(0, len(seq), 60):
                f.write(seq[j : j + 60] + "\n")


def run(genes_path: Path, cds_out: Path, protein_out: Path) -> None:
    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()
    print(f"{len(gene_ids)} genes; resolving canonical transcripts...", file=sys.stderr)

    canonical = resolve_canonical(gene_ids)
    tx_to_gene = {tx: gid for gid, tx in canonical.items()}
    print(f"{len(canonical)} canonical transcripts resolved", file=sys.stderr)

    cds = fetch_sequences(tx_to_gene, "cds")
    protein = fetch_sequences(tx_to_gene, "protein")
    print(f"CDS: {len(cds)} sequences; protein: {len(protein)} sequences", file=sys.stderr)

    for label, got in (("CDS", cds), ("protein", protein)):
        report_missing("gene", f"with no {label} sequence", [g for g in canonical if g not in got])

    write_fasta(cds_out, cds)
    write_fasta(protein_out, protein)
