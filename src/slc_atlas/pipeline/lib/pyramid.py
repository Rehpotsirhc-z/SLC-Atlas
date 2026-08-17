# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Coarser copies of a study's variants, carried inside the study's own bigBed.

A Manhattan lane zoomed out holds far more variants than it can show: at 250 kb to the column,
a thousand of them land on the same pixel and all but the topmost are ink nobody sees. A bigBed cannot answer that on its own, because the pyramid a bigBed carries
summarizes how many features cover a base rather than anything a feature says, so the strongest
variant in a stretch is not a question the format can be asked.

So the levels are built here, and each one holds whole variants rather than numbers: a mark at
any zoom is a real record, with its rsID, its exact p and its beta. A level keeps one variant per
occupied cell of the picture it will be drawn into, and drops the rest. Which cell a variant falls
in is the whole of the rule, and the cell is the mark itself: `bin` bases wide, a fraction of a
mark-radius tall.

What that buys is a switch nobody can see. A variant a level dropped sits within one column of
the variant that stood in for it, and within `1 / SAFETY` of a mark-radius above or below it, so
at any zoom where a column is at least `bin` wide the level draws the same picture the whole
study draws. Levels are read at exactly those zooms, so crossing between two of them moves
nothing on screen.
"""

import polars as pl

# Levels ride on the chromosome name so one file can hold them all: the app asks for a place on
# `chr1.z32768` the way it asks for a place on `chr1`, and the file's own index skips the rest
LEVEL_MARK = ".z"

# The lane's height in mark-radii, which is what makes a cell a mark rather than a pixel. This is
# the one thing the build must assume about a lane it never sees; a taller lane resolves more than
# this and would merge marks up to a whole radius apart rather than SAFETY times less
PLOT_ROWS = 45

# How much finer than a row the build quantizes. A dropped mark lands within a row over this, so
# at 2 it is half a mark-radius from the one that stood in for it
SAFETY = 2

# Columns assumed of a lane when working out how wide a view reads a level. Deliberately low: a
# wider lane shows a wider stretch at the same column width, which can only raise the axis it
# scales to, which can only make the level safer than it was measured to be
PLOT_COLUMNS = 1000

# A bin holding no more than this keeps every variant. Nothing can be hidden behind so few marks,
# and a stretch this empty is what would otherwise drag the whole level's quantum down: a view of
# bare ground scales its axis to whatever little it holds, so its rows are finer than anywhere
# else, and sizing every bin for it costs the levels several times over for ground holding nothing
KEEP_WHOLE = 8

# Each level is this much coarser than the one below it
LEVEL_STEP = 4

# The finest level. Below this a view is narrow enough that the study's own records are the
# cheaper read, since a level near this width keeps most of what it was built from anyway
FINEST_BIN = 8192


def level_chrom(chrom: str, bin_size: int) -> str:
    """The name a level's copy of a chromosome goes under."""
    return f"{chrom}{LEVEL_MARK}{bin_size}"


def ladder(sizes: dict[str, int]) -> list[int]:
    """The bins a study is reduced at, finest first.

    Stops once a level's own view covers the longest chromosome, since no view reaches wider.
    A lane with more columns than assumed reads a level finer than it strictly needs, which
    costs a little and shows the same picture, so erring coarse is the only way to err.
    """
    if not sizes:
        return []
    widest = max(sizes.values())
    bins, bin_size = [], FINEST_BIN
    while bin_size * PLOT_COLUMNS <= widest:
        bins.append(bin_size)
        bin_size *= LEVEL_STEP
    return bins


def y_cell(variants: pl.DataFrame, bin_size: int) -> float:
    """How much -log10 p one cell of a level stands for.

    The lane scales its axis to the strongest variant in view, so a row is worth that peak over
    the lane's rows, and how much a row is worth therefore depends on where the view is parked.
    A level is built once and cannot know, so it takes the weakest axis any view of its own width
    can land on. Views too sparse to prune are excluded, since they are reproduced whole and so
    ask nothing of the quantum.
    """
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
    """One variant per occupied cell, and every variant where a bin holds too few to hide any."""
    if cell <= 0:
        return variants
    marked = variants.with_columns(
        _x=pl.col("position") // bin_size,
        # An underflowed p is drawn above the scale rather than on it, so it occupies a cell of
        # its own and can never be dropped in favour of a finite value
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
        # Grouping reorders the columns, and stacking two frames goes by position
        .select(columns)
    )
    return pl.concat([whole, reduced])


def build(variants: pl.DataFrame, sizes: dict[str, int]) -> tuple[dict[str, int], list[dict]]:
    """The chromosomes a study's file holds, and what went into each level.

    The returned frames carry their level's chromosome names, so writing the file is a matter of
    emitting them in one order.
    """
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
