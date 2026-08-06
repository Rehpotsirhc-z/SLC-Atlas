# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch canonical-transcript CDS and protein sequences from the Ensembl REST API.

The same canonical transcript is used for both CDS and protein so the DNA and
amino-acid trees stay comparable.
"""

import sys
import time
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import post_json
from lib.reporting import report_missing

DATASET_DIR = Path(__file__).resolve().parents[2] / "data" / "dataset"
DEFAULT_GENES_PATH = DATASET_DIR / "genes.tsv"
DEFAULT_CDS_PATH = DATASET_DIR / "cds.fasta"
DEFAULT_PROTEIN_PATH = DATASET_DIR / "protein.fasta"

REST = "https://rest.ensembl.org"
LOOKUP_BATCH = 1000  # /lookup/id POST limit
SEQUENCE_BATCH = 50  # /sequence/id POST limit


def resolve_canonical(gene_ids: list[str]) -> dict[str, str]:
    """gene_id -> canonical transcript id (version stripped; the /sequence/id POST
    endpoint 404s on versioned IDs)."""
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
    """gene_id -> sequence string for the given Ensembl sequence type."""
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
        time.sleep(0.2)  # stay well under Ensembl's 15 req/s
    return out


def write_fasta(path: Path, sequences: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for gene_id, seq in sequences.items():
            f.write(f">{gene_id}\n")
            for j in range(0, len(seq), 60):
                f.write(seq[j : j + 60] + "\n")


def main() -> None:
    args = sys.argv[1:]
    genes_path = Path(args[0]) if len(args) > 0 else DEFAULT_GENES_PATH
    cds_path = Path(args[1]) if len(args) > 1 else DEFAULT_CDS_PATH
    protein_path = Path(args[2]) if len(args) > 2 else DEFAULT_PROTEIN_PATH

    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()
    print(f"{len(gene_ids)} genes; resolving canonical transcripts...", file=sys.stderr)

    canonical = resolve_canonical(gene_ids)
    tx_to_gene = {tx: gid for gid, tx in canonical.items()}
    print(f"{len(canonical)} canonical transcripts resolved", file=sys.stderr)

    cds = fetch_sequences(tx_to_gene, "cds")
    protein = fetch_sequences(tx_to_gene, "protein")
    print(f"CDS: {len(cds)} sequences; protein: {len(protein)} sequences", file=sys.stderr)

    for label, got in (("CDS", cds), ("protein", protein)):
        report_missing(f"gene(s) missing {label}", [g for g in canonical if g not in got])

    write_fasta(cds_path, cds)
    write_fasta(protein_path, protein)


if __name__ == "__main__":
    main()
