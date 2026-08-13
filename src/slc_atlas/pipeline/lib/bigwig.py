# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Read, resample, estimate, and write bigWig coverage tracks."""

import math
from pathlib import Path

import numpy as np

# Estimated from representative ATAC and RNA coverage tracks
BYTES_PER_ITEM = 9

SAMPLE_BASES = 4_000_000

# Spread samples across the genome to avoid bias from sparse regions
SAMPLE_PIECES = 24

# Windows a width is checked over before the app is told it may be drawn there
REDUCTION_SAMPLES = 8

# Columns compared per window, which is a screen's worth in miniature, and the fewest it may fall
# to when a window would otherwise grow past what is affordable to read exactly. A window of one
# column cannot be checked at all: what a summary carries in from beyond its edge is what the
# columns either side are for
REDUCTION_BINS = 100
REDUCTION_MIN_BINS = 8

# The widest a check window may be, since the exact reading it is compared against is the
# expensive half and the coarsest widths would otherwise ask for a hundred megabases of it
REDUCTION_MAX_WINDOW = 1_000_000

# The coarsest width worth checking: past this a whole chromosome fits on a screen
REDUCTION_MAX_SPAN = 1 << 20

# How much signal a summary may report beyond what the records beneath it hold, as a fraction of
# what is there. Summaries are lossy by construction, so this asks that they not invent coverage,
# which is the mistake that matters, rather than that they match
REDUCTION_TOLERANCE = 0.05

# What counts as nothing, as a fraction of the track's own maximum: a thousandth of a lane's height
# is less than the pixel it would be drawn in. Measured against the track's scale rather than the
# window's, since a window holding nothing has no scale of its own
REDUCTION_NOISE = 1e-3


def open_track(source: str):
    import pybigtools

    return pybigtools.open(str(source))


def chrom_sizes(source: str) -> dict[str, int]:
    return open_track(source).chroms()


def _sample(spans: dict[str, list[tuple[int, int]]], budget: int):
    """Sample a fixed number of bases across the available spans."""
    flat = [(chrom, start, end) for chrom in sorted(spans) for start, end in spans[chrom]]
    if not flat:
        return {}
    step = max(1, len(flat) // SAMPLE_PIECES)
    chosen = flat[::step][:SAMPLE_PIECES]
    piece = max(1, budget // len(chosen))
    taken: dict[str, list[tuple[int, int]]] = {}
    for index, (chrom, start, end) in enumerate(chosen):
        width = min(end - start, piece)
        offset = int((end - start - width) * (index + 0.5) / len(chosen))
        taken.setdefault(chrom, []).append((start + offset, start + offset + width))
    return taken


def effective_bin(reader, spans: dict[str, list[tuple[int, int]]], bin_size: int) -> int:
    """Return the bin size only when binning is expected to reduce the file size."""
    if bin_size <= 1:
        return 0
    return bin_size if estimate(reader, spans, bin_size) < estimate(reader, spans, 0) else 0


def _binned(reader, chrom: str, start: int, end: int, bin_size: int):
    """Return exact mean values per bin, treating uncovered bases as zero."""
    width = end - start
    bins = max(1, math.ceil(width / bin_size))
    edges = start + (np.arange(bins + 1, dtype=np.int64) * width) // bins
    values = np.asarray(
        reader.values(chrom, start, end, bins=bins, summary="mean", exact=True, fillna=0),
        dtype=np.float64,
    )
    return edges, values


def read(reader, spans: dict[str, list[tuple[int, int]]], bin_size: int):
    """Yield ``(chrom, start, end, value)`` over the spans, binned when asked.

    Equal neighbouring bins are emitted as one interval, which is most of why a binned copy
    is so much smaller than the intervals it was reduced from, and why a stretch a track
    holds nothing over costs a genome-wide copy almost nothing.
    """
    for chrom in sorted(spans):
        for start, end in spans[chrom]:
            if not bin_size:
                for record_start, record_end, value in reader.records(chrom, start, end):
                    yield chrom, max(record_start, start), min(record_end, end), value
                continue

            edges, values = _binned(reader, chrom, start, end, bin_size)
            runs = np.concatenate(([0], np.flatnonzero(np.diff(values)) + 1, [values.size])).astype(
                np.int64
            )
            for at, stop in zip(runs[:-1], runs[1:]):
                value = float(values[at])
                if value != 0.0 and not math.isnan(value):
                    yield chrom, int(edges[at]), int(edges[stop]), value


def estimate(reader, spans: dict[str, list[tuple[int, int]]], bin_size: int) -> int:
    """Estimate output size by sampling the requested spans."""
    sampled = _sample(spans, SAMPLE_BASES)
    sampled_bases = sum(end - start for w in sampled.values() for start, end in w)
    if not sampled_bases:
        return 0
    items = sum(1 for _ in read(reader, sampled, bin_size))
    total_bases = sum(end - start for w in spans.values() for start, end in w)
    return int(items * total_bases / sampled_bases * BYTES_PER_ITEM)


def _check_windows(sizes: dict[str, int], width: int) -> list[tuple[str, int, int]]:
    """Windows of one width spread across the largest chromosomes, gaps and all.

    Spread rather than sought out: on a sliced track most of a chromosome is gap, and it is the
    gaps a reduction level has to be caught lying about.
    """
    biggest = [(c, n) for c, n in sorted(sizes.items(), key=lambda item: -item[1])[:3] if n > width]
    if not biggest:
        return []
    each = max(1, REDUCTION_SAMPLES // len(biggest))
    windows = []
    for chrom, size in biggest:
        step = (size - width) / each
        for index in range(each):
            start = int(index * step)
            windows.append((chrom, start, start + width))
    return windows


def _span_agrees(reader, span: int, sizes: dict[str, int], ceiling: float) -> bool:
    """Whether summaries drawn at one column width invent signal the records beneath them lack.

    One-sided on purpose: a summary that reports less than the records hold is a lossy reading,
    which is what a summary is, while one that reports more is coverage that does not exist. The
    exact reading is dilated by a column either way first, because a summary record is aligned to
    its own level rather than to the columns asked for and may carry a neighbour's peak into one.
    """
    bins = max(REDUCTION_MIN_BINS, min(REDUCTION_BINS, REDUCTION_MAX_WINDOW // span))
    windows = _check_windows(sizes, (bins + 2) * span)
    if not windows:
        return False
    allowed = max(ceiling * REDUCTION_NOISE, 1e-9)
    for chrom, start, end in windows:
        exact = np.nan_to_num(
            np.asarray(
                reader.values(
                    chrom, start, end, bins=bins + 2, summary="max", exact=True, fillna=0
                ),
                np.float64,
            )
        )
        summary = np.nan_to_num(
            np.asarray(
                reader.values(
                    chrom, start + span, end - span, bins=bins, summary="max", exact=False, fillna=0
                ),
                np.float64,
            )
        )
        spill = np.maximum.reduce([exact[:-2], exact[1:-1], exact[2:]])
        if bool((summary > spill * (1 + REDUCTION_TOLERANCE) + allowed).any()):
            return False
    return True


def sound_reduction(reader) -> int:
    """The finest column width, in bases, whose summaries may be drawn, or 0 for none of them.

    A bigWig carries a pyramid of its own, and a view of a whole chromosome wants it: a few hundred
    summary records say what millions of stored ones would, and reading the millions is what makes
    zooming out cost seconds. The pyramid is only worth what whoever wrote it put in, though, and
    one written over sparse data has been seen to report a value across ground the track holds
    nothing over, which is the one mistake a coverage lane must not make. So it is read against the
    exact records beneath it before the app is told it may be drawn.

    What is checked is the width a view asks for rather than the levels themselves, because which
    level answers a width is the reader's own business and the two readers here are not the same
    one. Widths are checked from the coarsest down and the first failure ends it, so what comes
    back is a floor the app can compare its bases-per-pixel against.
    """
    levels = sorted(reader.zooms())
    if not levels:
        return 0
    sizes = reader.chroms()
    ceiling = float(reader.info()["summary"]["max"])
    finest = 1 << max(0, (levels[0] - 1).bit_length())
    spans = []
    while finest <= REDUCTION_MAX_SPAN:
        spans.append(finest)
        finest *= 2
    sound = 0
    for span in reversed(spans):
        if not _span_agrees(reader, span, sizes, ceiling):
            break
        sound = span
    return sound


def write(path: Path, chroms: dict[str, int], intervals) -> tuple[int, float]:
    """Write a bigWig and verify its chromosomes and signal values."""
    import pybigtools

    path.parent.mkdir(parents=True, exist_ok=True)
    counted = {"items": 0, "sum": 0.0, "chroms": set()}

    def watched():
        for chrom, start, end, value in intervals:
            counted["items"] += 1
            counted["sum"] += value * (end - start)
            counted["chroms"].add(chrom)
            yield chrom, start, end, value

    pybigtools.open(str(path), "w").write(chroms, watched())

    if not path.exists():
        raise RuntimeError(f"{path} was not written")

    written = pybigtools.open(str(path))
    if not set(written.chroms()) >= counted["chroms"]:
        missing = sorted(counted["chroms"] - set(written.chroms()))
        raise RuntimeError(f"{path} is missing {len(missing)} chromosomes: {missing[:5]}")

    total = written.info()["summary"]["sum"]
    if counted["items"] and abs(total - counted["sum"]) > max(1e-3, abs(counted["sum"]) * 1e-4):
        raise RuntimeError(
            f"{path} holds a different signal than was written to it "
            f"(read back {total}, wrote {counted['sum']})"
        )
    return counted["items"], counted["sum"]
