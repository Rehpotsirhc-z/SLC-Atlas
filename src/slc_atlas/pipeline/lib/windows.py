# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Define and merge the genomic regions retained by the browser pipeline."""

from dataclasses import dataclass
from pathlib import Path

import polars as pl

from . import chroms as chrom_names

FLANK_MIN = 100_000
FLANK_MAX = 500_000
MIN_WIDTH = 200_000


@dataclass(frozen=True)
class Window:
    gene_id: str
    symbol: str
    chrom: str
    chrom_ensembl: str
    chrom_size: int | None
    gene_start: int
    gene_end: int
    strand: str
    start: int
    end: int
    flank: int
    clipped: bool


def flank_for(span: int, flank_min: int, flank_max: int, min_width: int) -> int:
    """Half the context to add on each side of a gene of this length."""
    flank = min(max(span, flank_min), flank_max)
    return max(flank, -(-(min_width - span) // 2))


def gene_windows(
    rows,
    *,
    flank_min: int = FLANK_MIN,
    flank_max: int = FLANK_MAX,
    min_width: int = MIN_WIDTH,
    chrom_sizes: dict[str, int] | None = None,
    alias: dict[str, str] | None = None,
) -> tuple[list[Window], list[str]]:
    """Convert gene rows to zero-based browser windows and return unplaced genes."""
    alias = alias or {}
    sizes = chrom_sizes or {}
    windows, unplaced = [], []

    for gene_id, symbol, chromosome, start, end, strand in rows:
        if chromosome is None or start is None or end is None:
            unplaced.append(gene_id)
            continue
        chrom = alias.get(chromosome, chromosome)
        if alias and chromosome not in alias:
            unplaced.append(gene_id)
            continue

        gene_start, gene_end = start - 1, end
        half = flank_for(gene_end - gene_start, flank_min, flank_max, min_width)
        size = sizes.get(chrom)
        window_start = max(0, gene_start - half)
        window_end = gene_end + half if size is None else min(size, gene_end + half)

        windows.append(
            Window(
                gene_id=gene_id,
                symbol=symbol,
                chrom=chrom,
                chrom_ensembl=chromosome,
                chrom_size=size,
                gene_start=gene_start,
                gene_end=gene_end,
                strand=strand or "",
                start=window_start,
                end=window_end,
                flank=half,
                clipped=window_start == 0 or (size is not None and window_end == size),
            )
        )

    windows.sort(key=lambda w: (w.chrom, w.start, w.end))
    return windows, unplaced


GENE_COLUMNS = ["id", "symbol", "chromosome", "start", "end", "strand"]


def load(
    genes_path: Path,
    chroms_path: Path,
    *,
    flank_min: int = FLANK_MIN,
    flank_max: int = FLANK_MAX,
    min_width: int = MIN_WIDTH,
) -> tuple[list[Window], list[str]]:
    """Read the gene and chromosome tables and create a window for each gene."""
    genes = pl.read_csv(genes_path, separator="\t", columns=GENE_COLUMNS).select(GENE_COLUMNS)
    sizes = chrom_names.sizes(chrom_names.read_chroms(chroms_path))
    alias, _ = chrom_names.alias_map(sizes, genes["chromosome"].unique().to_list())
    return gene_windows(
        genes.rows(),
        flank_min=flank_min,
        flank_max=flank_max,
        min_width=min_width,
        chrom_sizes=sizes,
        alias=alias,
    )


def spans(
    genes_path: Path,
    chroms_path: Path,
    *,
    flank_min: int = FLANK_MIN,
    flank_max: int = FLANK_MAX,
    whole_genome: bool,
) -> dict[str, list[tuple[int, int]]]:
    """Return either the whole genome or merged windows around atlas genes."""
    if whole_genome:
        return chrom_names.whole_genome(chrom_names.read_chroms(chroms_path))
    placed, _ = load(genes_path, chroms_path, flank_min=flank_min, flank_max=flank_max)
    return merge(placed)


def merge(windows) -> dict[str, list[tuple[int, int]]]:
    """Collapse overlapping windows so a gene cluster is sliced once, not once per gene."""
    by_chrom: dict[str, list[tuple[int, int]]] = {}
    for window in windows:
        by_chrom.setdefault(window.chrom, []).append((window.start, window.end))

    merged = {}
    for chrom, spans in by_chrom.items():
        spans.sort()
        acc: list[tuple[int, int]] = []
        cur_start, cur_end = spans[0]
        for start, end in spans[1:]:
            if start > cur_end:
                acc.append((cur_start, cur_end))
                cur_start, cur_end = start, end
            else:
                cur_end = max(cur_end, end)
        acc.append((cur_start, cur_end))
        merged[chrom] = acc
    return merged


def extent(window: Window, merged: dict[str, list[tuple[int, int]]]) -> tuple[int, int]:
    """The merged span a window falls in, which is how far local bytes let the view pan."""
    for start, end in merged.get(window.chrom, ()):
        if start <= window.start and window.end <= end:
            return start, end
    return window.start, window.end


def covered_bases(merged: dict[str, list[tuple[int, int]]]) -> int:
    return sum(end - start for spans in merged.values() for start, end in spans)
