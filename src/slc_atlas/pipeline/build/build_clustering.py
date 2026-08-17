# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build sequence, expression, ortholog, and family-grouping trees."""

from pathlib import Path

import polars as pl

from ..lib import console, parquet

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

    # The coding alignment follows the shared protein alignment
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
        console.detail(f"{method}:")
        rows, newick = build(method)
        all_rows.extend(rows)
        (work_dir / f"tree_{method}.nwk").write_text(newick)
        n_leaves = sum(1 for r in rows if r["gene_id"])
        console.detail(f"{n_leaves} leaves, {len(rows)} nodes", indent=2)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    parquet.write(pl.DataFrame(all_rows, schema=CLUSTERING_SCHEMA), out_path)
    console.success(f"Wrote {out_path}")
