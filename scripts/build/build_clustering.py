# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the four gene-family similarity trees and write them to clustering.parquet.

Methods:
  aa_sequence            MAFFT MSA of canonical proteins -> p-distance -> UPGMA tree
  dna_sequence           MAFFT MSA of canonical CDS      -> p-distance -> UPGMA tree
  rna_coexpression_all   expression, all samples   -> 1 - Spearman corr -> UPGMA tree
  rna_coexpression_brain expression, brain samples -> 1 - Spearman corr -> UPGMA tree
  ortholog_identity      per-gene ortholog %-identity profile across the conservation
                         species (orthologs.tsv) -> 1 - Spearman corr -> UPGMA tree
  family_grouping        flat grouping by HGNC family (not a distance tree): root ->
                         one node per family -> gene leaves, all branch lengths zero

Every tree is serialized as a flat node table (one row per node) so the API can
return it without a Newick parser on the client:
  method, node_id, parent_id, branch_length, gene_id, symbol, family
Internal nodes have null gene_id/symbol/family; the root has null parent_id.

Trees are built with average-linkage (UPGMA) hierarchical clustering for all four
methods so topology and branch-length semantics are uniform across metrics. A
Newick file per method is also written under backend/data/raw/ for inspection.

Usage:
    python scripts/build/build_clustering.py
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
import polars as pl
from Bio import AlignIO
from scipy.cluster.hierarchy import linkage, to_tree
from scipy.spatial.distance import squareform
from scipy.stats import rankdata

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

SCHEMA = {
    "method": pl.Utf8,
    "node_id": pl.Int64,
    "parent_id": pl.Int64,
    "branch_length": pl.Float64,
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "family": pl.Utf8,
}


def run_mafft(in_fasta: Path, out_fasta: Path) -> None:
    # FFT-NS-2 (progressive, no iterative refinement): fast and accurate enough for
    # a family-level distance tree. --auto can pick the O(slow) iterative refinement
    # (dvtditr) for the longer CDS set, which runs for many minutes.
    print(f"  MAFFT (FFT-NS-2) aligning {in_fasta.name}...", file=sys.stderr)
    with open(out_fasta, "w", encoding="utf-8") as out:
        subprocess.run(
            [
                "mafft",
                "--retree",
                "2",
                "--maxiterate",
                "0",
                "--quiet",
                "--thread",
                "-1",
                str(in_fasta),
            ],
            stdout=out,
            check=True,
        )


def read_fasta(path: Path) -> dict[str, str]:
    seqs: dict[str, str] = {}
    name = None
    buf: list[str] = []
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            if name:
                seqs[name] = "".join(buf)
            name = line[1:].strip()
            buf = []
        else:
            buf.append(line.strip())
    if name:
        seqs[name] = "".join(buf)
    return seqs


def codon_align(protein_aln: Path, cds_fasta: Path, out_fasta: Path) -> None:
    """Impose the protein MSA onto the CDS codon-by-codon (back-translation
    alignment). Nucleotide MSA is frame-blind and noisy; aligning the proteins and
    projecting onto codons gives a high-quality, codon-aware CDS alignment that
    keeps the synonymous-substitution signal. CDS is the canonical transcript's
    coding sequence (verified to be exactly 3*(protein_len+1), i.e. ends in a stop
    codon), so each non-gap residue maps to the next CDS codon."""
    print(f"  codon-aligning {cds_fasta.name} via {protein_aln.name}...", file=sys.stderr)
    aln = read_fasta(protein_aln)
    cds = read_fasta(cds_fasta)
    with open(out_fasta, "w", encoding="utf-8") as out:
        for gene_id, aligned_prot in aln.items():
            nt = cds[gene_id]
            codons = []
            pos = 0
            for aa in aligned_prot:
                if aa == "-":
                    codons.append("---")
                else:
                    codons.append(nt[pos * 3 : pos * 3 + 3])
                    pos += 1
            out.write(f">{gene_id}\n{''.join(codons)}\n")


def pdistance(aligned_fasta: Path) -> tuple[list[str], np.ndarray]:
    """Pairwise p-distance: fraction of aligned columns that differ, ignoring any
    column where either sequence has a gap."""
    aln = AlignIO.read(aligned_fasta, "fasta")
    ids = [rec.id for rec in aln]
    codes = np.array([[ord(c) for c in str(rec.seq).upper()] for rec in aln], dtype=np.int16)
    gap = ord("-")
    n = len(ids)
    dist = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        ai = codes[i]
        ai_ok = ai != gap
        for j in range(i + 1, n):
            aj = codes[j]
            valid = ai_ok & (aj != gap)
            denom = valid.sum()
            p = float((valid & (ai != aj)).sum()) / denom if denom else 0.0
            dist[i, j] = dist[j, i] = p
    return ids, dist


def corr_distance(tpm: pl.DataFrame, sample_cols: list[str]) -> tuple[list[str], np.ndarray]:
    """1 - Spearman correlation across samples. Zero-variance genes (e.g. all-zero
    TPM) can't be correlated and are dropped."""
    mat = tpm.select(sample_cols).to_numpy()  # genes x samples
    ids = tpm["gene_id"].to_list()
    keep = mat.std(axis=1) > 0
    if not keep.all():
        dropped = [g for g, k in zip(ids, keep) if not k]
        print(f"  dropping {len(dropped)} zero-variance genes: {dropped[:5]}...", file=sys.stderr)
    mat = mat[keep]
    ids = [g for g, k in zip(ids, keep) if k]
    ranks = rankdata(mat, axis=1)  # Spearman = Pearson on ranks
    corr = np.corrcoef(ranks)
    dist = 1.0 - corr
    np.fill_diagonal(dist, 0.0)
    dist = np.clip(dist, 0.0, 2.0)
    return ids, dist


def ortho_distance(gene_ids: list[str]) -> tuple[list[str], np.ndarray]:
    """1 - Spearman correlation of per-gene ortholog %-identity profiles across the
    conservation species. Each gene's profile is its perc_id in every species; a
    species with no ortholog contributes 0 (no ortholog = 0% identity). Multiple
    orthologs in one species collapse to the last row, mirroring build_conservation's
    (gene, species) pick so the profile matches the heatmap cells. Genes with a flat
    profile (e.g. no orthologs anywhere) are zero-variance and get dropped by
    corr_distance."""
    orth = pl.read_csv(
        ORTHOLOGS_PATH, separator="\t", columns=["gene_id", "species", "perc_id"]
    ).with_columns(pl.col("perc_id").cast(pl.Float64, strict=False))
    orth = orth.group_by(["gene_id", "species"], maintain_order=True).agg(pl.col("perc_id").last())
    wide = orth.pivot(on="species", index="gene_id", values="perc_id")
    wide = pl.DataFrame({"gene_id": gene_ids}).join(wide, on="gene_id", how="left")
    species_cols = [c for c in wide.columns if c != "gene_id"]
    wide = wide.with_columns(pl.col(species_cols).fill_null(0.0))
    return corr_distance(wide, species_cols)


def family_grouping(
    gene_ids: list[str], meta: dict[str, dict], method: str
) -> tuple[list[dict], str]:
    """Flat family grouping: root -> one internal node per family -> gene leaves.
    All branch lengths are zero because this expresses family membership, not
    distance. Families are ordered alphabetically and genes by symbol within each
    family so the layout is stable."""
    fam_to_genes: dict[str, list[str]] = {}
    for gid in gene_ids:
        fam = meta.get(gid, {}).get("family") or "Unassigned"
        fam_to_genes.setdefault(fam, []).append(gid)

    rows: list[dict] = []
    next_id = 0

    def add(parent_id: int | None, gid: str | None = None) -> int:
        nonlocal next_id
        node_id = next_id
        next_id += 1
        m = meta.get(gid, {}) if gid else {}
        rows.append(
            {
                "method": method,
                "node_id": node_id,
                "parent_id": parent_id,
                "branch_length": 0.0,
                "gene_id": gid,
                "symbol": m.get("symbol") if gid else None,
                "family": m.get("family") if gid else None,
            }
        )
        return node_id

    root_id = add(None)
    fam_parts: list[str] = []
    for fam in sorted(fam_to_genes):
        fam_id = add(root_id)
        genes = sorted(fam_to_genes[fam], key=lambda g: (meta.get(g, {}).get("symbol") or g))
        leaf_parts = []
        for gid in genes:
            add(fam_id, gid)
            leaf_parts.append(f"{meta.get(gid, {}).get('symbol') or gid}:0.00000")
        fam_parts.append("(" + ",".join(leaf_parts) + "):0.00000")
    newick = "(" + ",".join(fam_parts) + ");"
    return rows, newick


def tree_rows(
    dist: np.ndarray, labels: list[str], meta: dict[str, dict], method: str
) -> tuple[list[dict], str]:
    """UPGMA linkage with ladderized flat node rows and matching Newick string.

    Children are ordered larger-subtree-first at every split, the mirror of a plain
    smaller-first ladderization: it keeps basal/singleton branches together on one
    side while orienting the layout so the denser, higher-signal clades sit at the top
    of the row order instead of the bottom. node_ids are assigned in the resulting
    preorder so the flat table's sibling order is stable regardless of how the client
    reads it."""
    z = linkage(squareform(dist, checks=False), method="average")
    root = to_tree(z)

    rows: list[dict] = []
    next_id = 0

    def visit(node, parent_id: int | None, parent_dist: float) -> str:
        nonlocal next_id
        node_id = next_id
        next_id += 1
        bl = max(0.0, parent_dist - node.dist) if parent_id is not None else 0.0
        if node.is_leaf():
            gid = labels[node.id]
            m = meta.get(gid, {})
            rows.append(
                {
                    "method": method,
                    "node_id": node_id,
                    "parent_id": parent_id,
                    "branch_length": bl,
                    "gene_id": gid,
                    "symbol": m.get("symbol"),
                    "family": m.get("family"),
                }
            )
            return f"{gid}:{bl:.5f}"
        rows.append(
            {
                "method": method,
                "node_id": node_id,
                "parent_id": parent_id,
                "branch_length": bl,
                "gene_id": None,
                "symbol": None,
                "family": None,
            }
        )
        kids = sorted([node.get_left(), node.get_right()], key=lambda c: c.count)[::-1]
        parts = [visit(c, node_id, node.dist) for c in kids]
        return f"({','.join(parts)}):{bl:.5f}"

    newick = visit(root, None, 0.0) + ";"
    return rows, newick


def main() -> None:
    sys.setrecursionlimit(10000)
    genes = pl.read_csv(GENES_PATH, separator="\t", columns=["id", "symbol", "family"])
    meta = {
        r["id"]: {"symbol": r["symbol"], "family": r["family"]} for r in genes.iter_rows(named=True)
    }

    gene_ids_in_table = set(genes["id"].to_list())
    tpm = pl.read_parquet(TPM_PATH).filter(pl.col("gene_id").is_in(gene_ids_in_table))
    tissue = pl.read_csv(TISSUE_PATH, separator="\t")
    all_samples = [c for c in tpm.columns if c != "gene_id"]
    brain_set = set(tissue.filter(pl.col("tissue") == "Brain")["sample_id"].to_list())
    brain_samples = [c for c in all_samples if c in brain_set]

    # Align proteins once; reuse for the AA tree and as the scaffold for the
    # codon-aware CDS alignment (DNA tree).
    protein_aln = RAW_DIR / "aligned_protein.fasta"
    cds_aln = RAW_DIR / "aligned_cds_codon.fasta"
    run_mafft(PROTEIN_FASTA, protein_aln)
    codon_align(protein_aln, CDS_FASTA, cds_aln)

    all_rows: list[dict] = []
    for method, build in [
        ("aa_sequence", lambda: pdistance(protein_aln)),
        ("dna_sequence", lambda: pdistance(cds_aln)),
        ("rna_coexpression_all", lambda: corr_distance(tpm, all_samples)),
        ("rna_coexpression_brain", lambda: corr_distance(tpm, brain_samples)),
        ("ortholog_identity", lambda: ortho_distance(genes["id"].to_list())),
    ]:
        print(f"[{method}]", file=sys.stderr)
        ids, dist = build()
        rows, newick = tree_rows(dist, ids, meta, method)
        all_rows.extend(rows)
        (RAW_DIR / f"tree_{method}.nwk").write_text(newick)
        n_leaves = sum(1 for r in rows if r["gene_id"])
        print(f"  {n_leaves} leaves, {len(rows)} nodes", file=sys.stderr)

    print("[family_grouping]", file=sys.stderr)
    rows, newick = family_grouping(genes["id"].to_list(), meta, "family_grouping")
    all_rows.extend(rows)
    (RAW_DIR / "tree_family_grouping.nwk").write_text(newick)
    n_leaves = sum(1 for r in rows if r["gene_id"])
    print(f"  {n_leaves} leaves, {len(rows)} nodes", file=sys.stderr)

    pl.DataFrame(all_rows, schema=SCHEMA).write_parquet(OUT_PATH)
    print(f"wrote {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
