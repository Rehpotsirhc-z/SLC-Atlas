# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The alignments and the distance measures that the clustering trees are built from.

Each measure returns the gene labels together with the matrix of distances between them,
in the form that the average-linkage clustering expects.
"""

import subprocess
import sys
from pathlib import Path

import polars as pl


def run_mafft(mafft: str, in_fasta: Path, out_fasta: Path) -> None:
    # MAFFT's --auto chooses iterative refinement, which takes many minutes on the coding
    # sequences, and FFT-NS-2 is accurate enough for a distance tree across one family
    print(f"  MAFFT (FFT-NS-2) aligning {in_fasta.name}...", file=sys.stderr)
    with open(out_fasta, "w", encoding="utf-8") as out:
        subprocess.run(
            [
                mafft,
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
    """Align the coding sequences by following the protein alignment one codon at a time.

    Aligning the nucleotides directly takes no account of the reading frame and gives a
    noisy result, whereas following the protein alignment keeps the differences between
    codons that code for the same residue. The coding sequence is the one belonging to the
    canonical transcript, so each residue that is not a gap corresponds to the next codon.
    """
    print(f"  Codon-aligning {cds_fasta.name} via {protein_aln.name}...", file=sys.stderr)
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


def pdistance(aligned_fasta: Path):
    """Measure the distance between two sequences as the fraction of the aligned columns
    that differ, leaving out any column where either of them has a gap."""
    import numpy as np
    from Bio import AlignIO

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


def corr_distance(tpm: pl.DataFrame, sample_cols: list[str]):
    """Measure the distance between two genes as one minus the Spearman correlation of
    their expression across the samples. A gene whose expression does not vary at all is
    left out."""
    import numpy as np
    from scipy.stats import rankdata

    mat = tpm.select(sample_cols).to_numpy()  # A row per gene and a column per sample
    ids = tpm["gene_id"].to_list()
    keep = mat.std(axis=1) > 0
    if not keep.all():
        dropped = [g for g, k in zip(ids, keep) if not k]
        print(f"  Dropping {len(dropped)} zero-variance genes: {dropped[:5]}...", file=sys.stderr)
    mat = mat[keep]
    ids = [g for g, k in zip(ids, keep) if k]
    ranks = rankdata(mat, axis=1)  # Spearman is Pearson applied to the ranks
    corr = np.corrcoef(ranks)
    dist = 1.0 - corr
    np.fill_diagonal(dist, 0.0)
    dist = np.clip(dist, 0.0, 2.0)
    return ids, dist


def ortho_distance(gene_ids: list[str], orthologs_path: Path):
    """Measure the distance between two genes as one minus the Spearman correlation of the
    percentage identities of their orthologs across the species.

    A species in which a gene has no ortholog counts as zero. Where a gene has more than
    one ortholog in a species, the last one in the file is used, which is what
    build_conservation does as well, so that these numbers are the ones the conservation
    heatmap shows.
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
