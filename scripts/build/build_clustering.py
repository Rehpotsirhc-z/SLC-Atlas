# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the gene-family similarity trees and write them to clustering.parquet.

Methods:
  aa_sequence            MAFFT MSA of canonical proteins -> p-distance -> UPGMA tree
  dna_sequence           MAFFT MSA of canonical CDS      -> p-distance -> UPGMA tree
  rna_coexpression_all   expression, all samples   -> 1 - Spearman corr -> UPGMA tree
  rna_coexpression_brain expression, brain samples -> 1 - Spearman corr -> UPGMA tree
  ortholog_identity      per-gene ortholog %-identity profile across the conservation
                         species (orthologs.tsv) -> 1 - Spearman corr -> UPGMA tree
  family_grouping        flat grouping by HGNC family (not a distance tree)

Every distance method uses average linkage (UPGMA) so topology and branch-length
semantics stay comparable. A Newick per method is also written under backend/data/raw/.

Usage:
    python scripts/build/build_clustering.py
"""

import sys
from pathlib import Path

import polars as pl

from clustering_metrics import codon_align, corr_distance, ortho_distance, pdistance, run_mafft
from tree_table import CLUSTERING_SCHEMA, family_grouping, tree_rows

DATA_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
RAW_DIR = DATA_DIR / "raw"
DATASET_DIR = DATA_DIR / "dataset"
GENES_PATH = DATASET_DIR / "genes.tsv"
CDS_FASTA = DATASET_DIR / "cds.fasta"
PROTEIN_FASTA = DATASET_DIR / "protein.fasta"
TPM_PATH = DATASET_DIR / "expression.parquet"
TISSUE_PATH = DATASET_DIR / "sample_tissue.tsv"
ORTHOLOGS_PATH = DATASET_DIR / "orthologs.tsv"
OUT_PATH = DATA_DIR / "clustering.parquet"


def main() -> None:
    sys.setrecursionlimit(10000)
    genes = pl.read_csv(GENES_PATH, separator="\t", columns=["id", "symbol", "family"])
    meta = {
        r["id"]: {"symbol": r["symbol"], "family": r["family"]} for r in genes.iter_rows(named=True)
    }
    gene_ids = genes["id"].to_list()

    tpm = pl.read_parquet(TPM_PATH).filter(pl.col("gene_id").is_in(set(gene_ids)))
    tissue = pl.read_csv(TISSUE_PATH, separator="\t")
    all_samples = [c for c in tpm.columns if c != "gene_id"]
    brain_set = set(tissue.filter(pl.col("tissue") == "Brain")["sample_id"].to_list())
    brain_samples = [c for c in all_samples if c in brain_set]

    # Align proteins once; reuse for the AA tree and as the scaffold for the
    # codon-aware CDS alignment (DNA tree)
    protein_aln = RAW_DIR / "aligned_protein.fasta"
    cds_aln = RAW_DIR / "aligned_cds_codon.fasta"
    run_mafft(PROTEIN_FASTA, protein_aln)
    codon_align(protein_aln, CDS_FASTA, cds_aln)

    methods = [
        ("aa_sequence", lambda m: tree_rows(*pdistance(protein_aln), meta, m)),
        ("dna_sequence", lambda m: tree_rows(*pdistance(cds_aln), meta, m)),
        ("rna_coexpression_all", lambda m: tree_rows(*corr_distance(tpm, all_samples), meta, m)),
        ("rna_coexpression_brain", lambda m: tree_rows(*corr_distance(tpm, brain_samples), meta, m)),
        (
            "ortholog_identity",
            lambda m: tree_rows(*ortho_distance(gene_ids, ORTHOLOGS_PATH), meta, m),
        ),
        ("family_grouping", lambda _: family_grouping(gene_ids, meta)),
    ]

    all_rows: list[dict] = []
    for method, build in methods:
        print(f"[{method}]", file=sys.stderr)
        rows, newick = build(method)
        all_rows.extend(rows)
        (RAW_DIR / f"tree_{method}.nwk").write_text(newick)
        n_leaves = sum(1 for r in rows if r["gene_id"])
        print(f"  {n_leaves} leaves, {len(rows)} nodes", file=sys.stderr)

    pl.DataFrame(all_rows, schema=CLUSTERING_SCHEMA).write_parquet(OUT_PATH)
    print(f"wrote {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
