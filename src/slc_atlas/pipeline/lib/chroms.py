# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Chromosome names, and the one place that knows they come in more than one spelling.

Gene coordinates reach the pipeline from Ensembl, which calls a chromosome ``9``. Coverage
tracks, BED annotations, and GWAS payloads are almost always written in the UCSC spelling,
``chr9``. Neither side is wrong, so the browser stores everything in the track spelling,
which is what a bigWig will be asked for, and carries the Ensembl spelling beside it for
joining back to the gene tables.

Nothing outside this module may test a chromosome name for a ``chr`` prefix or guess at a
mitochondrial name.
"""

import csv
from dataclasses import dataclass
from pathlib import Path

AUTOSOMES = {str(n) for n in range(1, 100)}
SEX = {"X", "Y", "W", "Z"}
MITOCHONDRIA = {"M"}

PRIMARY = "primary"
UNPLACED = "unplaced"
ALT = "alt"

# Anything a source calls the mitochondrion, keyed to the one name we normalise to
_MITO_ALIASES = {"MT", "MITO", "MTDNA", "CHRM"}

_HEADER = ("chrom", "size", "role")


@dataclass(frozen=True)
class Chrom:
    name: str
    size: int
    role: str


def normalise(name: str) -> str:
    """Reduce a chromosome name to the key both spellings share."""
    key = name.strip().upper()
    if key.startswith("CHR"):
        key = key[3:]
    if key in _MITO_ALIASES:
        return "M"
    return key


def role(name: str) -> str:
    """Say whether a chromosome is one an atlas gene can sit on.

    Only primary chromosomes are ever sliced or served: an alt haplotype duplicates a
    region that the primary already carries, so drawing both would show the same signal
    twice under two names.
    """
    key = normalise(name)
    if key in AUTOSOMES or key in SEX or key in MITOCHONDRIA:
        return PRIMARY
    if "_" in key or key.startswith(("GL", "KI", "JH", "KZ", "ML", "KN", "KQ")):
        return ALT
    return UNPLACED


def primary(names) -> list[str]:
    return [name for name in names if role(name) == PRIMARY]


def alias_map(track_names, gene_names) -> tuple[dict[str, str], list[str]]:
    """Map each gene-table chromosome onto the name the track files use.

    Returns the mapping and the gene-table names that no track spells any way at all, which
    the caller reports rather than guessing at.
    """
    by_key = {normalise(name): name for name in track_names}
    mapping, missing = {}, []
    for name in gene_names:
        match = by_key.get(normalise(name))
        if match is None:
            missing.append(name)
        else:
            mapping[name] = match
    return mapping, missing


def read_chroms(path: Path) -> list[Chrom]:
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        return [Chrom(r["chrom"], int(r["size"]), r["role"]) for r in reader]


def write_chroms(path: Path, chroms) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(_HEADER)
        for chrom in chroms:
            writer.writerow([chrom.name, chrom.size, chrom.role])


def sizes(chroms) -> dict[str, int]:
    return {chrom.name: chrom.size for chrom in chroms}
