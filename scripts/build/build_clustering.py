# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the four gene-family similarity trees and write them to clustering.parquet.

Methods:
  aa_sequence            MAFFT MSA of canonical proteins -> p-distance -> UPGMA tree
  dna_sequence           MAFFT MSA of canonical CDS      -> p-distance -> UPGMA tree
  rna_coexpression_all   expression, all samples   -> 1 - Spearman corr -> UPGMA tree
  rna_coexpression_brain expression, brain samples -> 1 - Spearman corr -> UPGMA tree

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


def to_newick(node, labels: list[str], parent_dist: float) -> str:
    bl = max(0.0, parent_dist - node.dist)
    if node.is_leaf():
        return f"{labels[node.id]}:{bl:.5f}"
    left = to_newick(node.get_left(), labels, node.dist)
    right = to_newick(node.get_right(), labels, node.dist)
    return f"({left},{right}):{bl:.5f}"


def tree_rows(
    dist: np.ndarray, labels: list[str], meta: dict[str, dict], method: str
) -> tuple[list[dict], str]:
    """UPGMA linkage -> flat node rows + a Newick string."""
    z = linkage(squareform(dist, checks=False), method="average")
    n = len(labels)

    height = {i: 0.0 for i in range(n)}
    parent = {}
    for i, (c1, c2, d, _) in enumerate(z):
        node = n + i
        height[node] = float(d)
        parent[int(c1)] = node
        parent[int(c2)] = node

    rows = []
    for node in range(n + len(z)):
        p = parent.get(node)
        bl = (height[p] - height[node]) if p is not None else 0.0
        if node < n:
            gid = labels[node]
            m = meta.get(gid, {})
            rows.append(
                {
                    "method": method,
                    "node_id": node,
                    "parent_id": p,
                    "branch_length": max(0.0, bl),
                    "gene_id": gid,
                    "symbol": m.get("symbol"),
                    "family": m.get("family"),
                }
            )
        else:
            rows.append(
                {
                    "method": method,
                    "node_id": node,
                    "parent_id": p,
                    "branch_length": max(0.0, bl),
                    "gene_id": None,
                    "symbol": None,
                    "family": None,
                }
            )

    root = to_tree(z)
    newick = to_newick(root, labels, root.dist) + ";"
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
    ]:
        print(f"[{method}]", file=sys.stderr)
        ids, dist = build()
        rows, newick = tree_rows(dist, ids, meta, method)
        all_rows.extend(rows)
        (RAW_DIR / f"tree_{method}.nwk").write_text(newick)
        n_leaves = sum(1 for r in rows if r["gene_id"])
        print(f"  {n_leaves} leaves, {len(rows)} nodes", file=sys.stderr)

    pl.DataFrame(all_rows, schema=SCHEMA).write_parquet(OUT_PATH)
    print(f"wrote {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
