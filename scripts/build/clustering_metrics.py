# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Alignment and pairwise-distance metrics behind the clustering trees.

Each metric returns (labels, distance_matrix) ready for UPGMA linkage.
"""

import subprocess
import sys
from pathlib import Path

import numpy as np
import polars as pl
from Bio import AlignIO
from scipy.stats import rankdata


def run_mafft(in_fasta: Path, out_fasta: Path) -> None:
    # --auto picks iterative refinement (dvtditr), which runs for many minutes on the
    # CDS set; FFT-NS-2 is accurate enough for a family-level distance tree
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
    """Impose the protein MSA onto the CDS codon by codon.

    Nucleotide MSA is frame-blind and noisy; back-translating the protein alignment
    keeps the synonymous-substitution signal. CDS is the canonical transcript's coding
    sequence, so each non-gap residue maps to the next codon.
    """
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
    """Fraction of aligned columns that differ, ignoring gapped columns."""
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
    """1 - Spearman correlation across samples; zero-variance genes are dropped."""
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


def ortho_distance(gene_ids: list[str], orthologs_path: Path) -> tuple[list[str], np.ndarray]:
    """1 - Spearman correlation of per-gene ortholog %-identity profiles.

    A species with no ortholog contributes 0. Multiple orthologs in one species
    collapse to the last row, mirroring build_conservation's (gene, species) pick so the
    profile matches the heatmap cells.
    """
    orth = pl.read_csv(
        orthologs_path, separator="\t", columns=["gene_id", "species", "perc_id"]
    ).with_columns(pl.col("perc_id").cast(pl.Float64, strict=False))
    orth = orth.group_by(["gene_id", "species"], maintain_order=True).agg(pl.col("perc_id").last())
    wide = orth.pivot(on="species", index="gene_id", values="perc_id")
    wide = pl.DataFrame({"gene_id": gene_ids}).join(wide, on="gene_id", how="left")
    species_cols = [c for c in wide.columns if c != "gene_id"]
    wide = wide.with_columns(pl.col(species_cols).fill_null(0.0))
    return corr_distance(wide, species_cols)
