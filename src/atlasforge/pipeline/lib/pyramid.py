# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build reduced GWAS variant levels for wide genome-browser views."""

import polars as pl

# Encode pyramid levels as synthetic chromosomes in the study bigBed
LEVEL_MARK = ".z"

# Maximum number of variants retained per horizontal bin
PLOT_ROWS = 6

# Vertical subdivisions per plot row
SAFETY = 1

# Assumed plot width used to size each pyramid level
PLOT_COLUMNS = 1000

# Preserve sparse bins without reduction
KEEP_WHOLE = 8

LEVEL_STEP = 2

# Narrower views read the original study records
FINEST_BIN = 2048


def level_chrom(chrom: str, bin_size: int) -> str:
    """Return the synthetic chromosome name for a pyramid level."""
    return f"{chrom}{LEVEL_MARK}{bin_size}"


def ladder(sizes: dict[str, int]) -> list[int]:
    """Return pyramid bin sizes from finest to coarsest."""
    if not sizes:
        return []
    widest = max(sizes.values())
    bins, bin_size = [], FINEST_BIN
    while bin_size * PLOT_COLUMNS <= widest:
        bins.append(bin_size)
        bin_size *= LEVEL_STEP
    return bins


def y_cell(variants: pl.DataFrame, bin_size: int) -> float:
    """Return the vertical cell size for a pyramid level."""
    span = bin_size * PLOT_COLUMNS
    windows = (
        variants.with_columns(w=pl.col("position") // span)
        .group_by("chrom", "w")
        .agg(pl.col("neg_log10_p").max().alias("peak"), pl.len().alias("n"))
        .filter((pl.col("n") > KEEP_WHOLE) & pl.col("peak").is_not_null() & (pl.col("peak") > 0))
    )
    if windows.is_empty():
        return 0.0
    return float(windows["peak"].min()) / PLOT_ROWS / SAFETY


def prune(variants: pl.DataFrame, bin_size: int, cell: float) -> pl.DataFrame:
    """Reduce dense bins to one variant per occupied cell."""
    if cell <= 0:
        return variants
    marked = variants.with_columns(
        _x=pl.col("position") // bin_size,
        # Keep underflowed p-values in a separate cell
        _y=pl.when(pl.col("neg_log10_p").is_null())
        .then(-1)
        .otherwise((pl.col("neg_log10_p") / cell).floor().cast(pl.Int64)),
    ).with_columns(_n=pl.len().over("chrom", "_x"))
    columns = variants.columns
    whole = marked.filter(pl.col("_n") <= KEEP_WHOLE).select(columns)
    reduced = (
        marked.filter(pl.col("_n") > KEEP_WHOLE)
        .sort("neg_log10_p", descending=True, nulls_last=False)
        .group_by("chrom", "_x", "_y")
        .head(1)
        # Restore column order before concatenation
        .select(columns)
    )
    return pl.concat([whole, reduced])


def build(variants: pl.DataFrame, sizes: dict[str, int]) -> tuple[dict[str, int], list[dict]]:
    """Build pyramid levels and their synthetic chromosome sizes."""
    built = []
    for bin_size in ladder(sizes):
        cell = y_cell(variants, bin_size)
        reduced = prune(variants, bin_size, cell).with_columns(
            chrom=pl.col("chrom").replace_strict(
                {name: level_chrom(name, bin_size) for name in sizes}, default=None
            )
        )
        built.append({"bin": bin_size, "cell": cell, "frame": reduced, "rows": reduced.height})

    chroms = dict(sizes)
    for level in built:
        for name, size in sizes.items():
            chroms[level_chrom(name, level["bin"])] = size
    return chroms, built
