# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the trees that show how similar the genes of the family are, and write them to
clustering.parquet.

There is one tree per method, and the methods are these.

  aa_sequence             MAFFT aligns the canonical proteins, and the distance between
                          two genes is the fraction of aligned residues that differ.
  dna_sequence            The same, using the canonical coding sequences.
  rna_coexpression_all    The distance between two genes is one minus the Spearman
                          correlation of their expression across all GTEx samples.
  rna_coexpression_brain  The same, using only the brain samples.
  ortholog_identity       Each gene has a percentage identity in each of the conservation
                          species, read from orthologs.tsv, and the distance between two
                          genes is one minus the Spearman correlation of those.
  family_grouping         Genes grouped by the HGNC family they belong to, which is a
                          grouping rather than a tree built from distances.

Every method that measures a distance builds its tree by average linkage, which is also
called UPGMA, so that the shape of the trees and the lengths of their branches mean the
same thing from one method to the next. Each tree is also written as Newick under
work_dir.
"""

import sys
from pathlib import Path

import polars as pl

from .clustering_metrics import codon_align, corr_distance, ortho_distance, pdistance, run_mafft
from .tree_table import CLUSTERING_SCHEMA, family_grouping, tree_rows


def run(source_dir: Path, out_dir: Path, work_dir: Path, mafft: str) -> None:
    genes_path = source_dir / "genes.tsv"
    cds_fasta = source_dir / "cds.fasta"
    protein_fasta = source_dir / "protein.fasta"
    tpm_path = source_dir / "expression.parquet"
    tissue_path = source_dir / "sample_tissue.tsv"
    orthologs_path = source_dir / "orthologs.tsv"
    out_path = out_dir / "clustering.parquet"

    genes = pl.read_csv(genes_path, separator="\t", columns=["id", "symbol", "family"])
    meta = {
        r["id"]: {"symbol": r["symbol"], "family": r["family"]} for r in genes.iter_rows(named=True)
    }
    gene_ids = genes["id"].to_list()

    tpm = pl.read_parquet(tpm_path).filter(pl.col("gene_id").is_in(set(gene_ids)))
    tissue = pl.read_csv(tissue_path, separator="\t")
    all_samples = [c for c in tpm.columns if c != "gene_id"]
    brain_set = set(tissue.filter(pl.col("tissue") == "Brain")["sample_id"].to_list())
    brain_samples = [c for c in all_samples if c in brain_set]

    work_dir.mkdir(parents=True, exist_ok=True)

    # The protein alignment is built once and used for the amino-acid tree and as the
    # scaffold the coding sequences are aligned codon by codon against for the DNA tree
    protein_aln = work_dir / "aligned_protein.fasta"
    cds_aln = work_dir / "aligned_cds_codon.fasta"
    run_mafft(mafft, protein_fasta, protein_aln)
    codon_align(protein_aln, cds_fasta, cds_aln)

    methods = [
        ("aa_sequence", lambda m: tree_rows(*pdistance(protein_aln), meta, m)),
        ("dna_sequence", lambda m: tree_rows(*pdistance(cds_aln), meta, m)),
        ("rna_coexpression_all", lambda m: tree_rows(*corr_distance(tpm, all_samples), meta, m)),
        (
            "rna_coexpression_brain",
            lambda m: tree_rows(*corr_distance(tpm, brain_samples), meta, m),
        ),
        (
            "ortholog_identity",
            lambda m: tree_rows(*ortho_distance(gene_ids, orthologs_path), meta, m),
        ),
        ("family_grouping", lambda _: family_grouping(gene_ids, meta)),
    ]

    all_rows: list[dict] = []
    for method, build in methods:
        print(f"[{method}]", file=sys.stderr)
        rows, newick = build(method)
        all_rows.extend(rows)
        (work_dir / f"tree_{method}.nwk").write_text(newick)
        n_leaves = sum(1 for r in rows if r["gene_id"])
        print(f"  {n_leaves} leaves, {len(rows)} nodes", file=sys.stderr)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(all_rows, schema=CLUSTERING_SCHEMA).write_parquet(out_path)
    print(f"Wrote {out_path}", file=sys.stderr)
