# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the coding and the protein sequence of each gene from the Ensembl REST API.

Both sequences are taken from the same canonical transcript, so that the DNA tree and the
amino-acid tree can be compared with each other.
"""

from pathlib import Path

import polars as pl

from ..lib import console

from ..lib.http import post_json
from ..lib.reporting import FAILURE, attempt, report_missing

REST = "https://rest.ensembl.org"
LOOKUP_BATCH = 1000  # The most ids /lookup/id accepts in one request
SEQUENCE_BATCH = 50  # The most ids /sequence/id accepts in one request


def resolve_canonical(gene_ids: list[str]) -> dict[str, str]:
    """Return the id of the canonical transcript of each gene, keyed by gene id. The
    version suffix is removed because /sequence/id answers 404 for a versioned id."""
    mapping: dict[str, str] = {}
    refused: list[str] = []
    without: list[str] = []
    for i in range(0, len(gene_ids), LOOKUP_BATCH):
        chunk = gene_ids[i : i + LOOKUP_BATCH]
        result = attempt(
            f"{chunk[0]}..{chunk[-1]}",
            lambda: post_json(f"{REST}/lookup/id", {"ids": chunk}),
            refused,
        )
        for gid in chunk:
            info = (result or {}).get(gid)
            if not info or not info.get("canonical_transcript"):
                without.append(gid)
                continue
            mapping[gid] = info["canonical_transcript"].split(".")[0]
    report_missing(
        "batch/batches",
        "of genes Ensembl would not look up, so their sequences are missing",
        refused,
        severity=FAILURE,
    )
    report_missing(
        "gene", "with no canonical transcript at Ensembl", without, checked=len(gene_ids)
    )
    return mapping


def fetch_sequences(tx_to_gene: dict[str, str], seq_type: str) -> dict[str, str]:
    """Return the sequence of the given Ensembl sequence type for each gene, keyed by gene
    id."""
    out: dict[str, str] = {}
    tx_ids = list(tx_to_gene)
    refused: list[str] = []
    for i in range(0, len(tx_ids), SEQUENCE_BATCH):
        chunk = tx_ids[i : i + SEQUENCE_BATCH]
        records = attempt(
            f"{chunk[0]}..{chunk[-1]}",
            lambda: post_json(f"{REST}/sequence/id?type={seq_type}", {"ids": chunk}),
            refused,
        )
        for rec in records or []:
            tx = rec.get("query") or rec.get("id")
            gene_id = tx_to_gene.get(tx)
            seq = rec.get("seq")
            if gene_id and seq:
                out[gene_id] = seq
    report_missing(
        "batch/batches",
        f"of {seq_type} sequences Ensembl would not send, so those genes have none",
        refused,
        severity=FAILURE,
    )
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
    console.detail(f"{len(gene_ids)} genes; resolving canonical transcripts...")

    canonical = resolve_canonical(gene_ids)
    tx_to_gene = {tx: gid for gid, tx in canonical.items()}
    console.detail(f"{len(canonical)} canonical transcripts resolved")

    cds = fetch_sequences(tx_to_gene, "cds")
    protein = fetch_sequences(tx_to_gene, "protein")
    console.detail(f"CDS: {len(cds)} sequences; protein: {len(protein)} sequences")

    for label, got in (("CDS", cds), ("protein", protein)):
        report_missing("gene", f"with no {label} sequence", [g for g in canonical if g not in got])

    write_fasta(cds_out, cds)
    write_fasta(protein_out, protein)
