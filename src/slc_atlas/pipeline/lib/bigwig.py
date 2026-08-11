# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Reading coverage out of a bigWig and writing a family-scoped one back.

A published coverage track covers the whole genome and runs to gigabytes, while an atlas
only ever draws the windows around its own genes, which is a few percent of it. So the
pipeline writes a new bigWig holding just those windows. The format keeps its own pyramid
of reduced views, so one sliced file still answers every zoom level by byte range and the
browser never needs a server.

A source may be a path or a URL: bigWig is read by byte range either way, so a track can be
sliced straight out of a public file without downloading it first.

This is the only module that imports pybigtools.
"""

import math
from pathlib import Path

# Measured across the ATAC and RNA tracks this was built against, whose sliced files ran
# between 7.5 and 11.5 bytes for each interval written. Only ever used to warn about size
# before a slice runs, never to decide anything
BYTES_PER_ITEM = 9

SAMPLE_BASES = 4_000_000

# A bin can only shrink a file when the source is finer than the bin, so a track already
# written in long runs is copied across untouched rather than being chopped into more
# intervals than it started with
BIN_WORTH_IT = 1.0


def open_track(source: str):
    import pybigtools

    return pybigtools.open(str(source))


def chrom_sizes(source: str) -> dict[str, int]:
    return open_track(source).chroms()


def _sample(spans: dict[str, list[tuple[int, int]]], budget: int):
    """Spread a fixed number of bases over the windows, so no one chromosome speaks alone."""
    flat = [(chrom, start, end) for chrom in sorted(spans) for start, end in spans[chrom]]
    if not flat:
        return {}
    step = max(1, len(flat) // 24)
    taken, total = {}, 0
    for chrom, start, end in flat[::step]:
        width = min(end - start, budget - total)
        if width <= 0:
            break
        taken.setdefault(chrom, []).append((start, start + width))
        total += width
    return taken


def density(reader, spans: dict[str, list[tuple[int, int]]]) -> float:
    """Intervals per base in the source, which is what says whether binning would help."""
    intervals, bases = 0, 0
    for chrom, windows in _sample(spans, SAMPLE_BASES).items():
        for start, end in windows:
            intervals += sum(1 for _ in reader.records(chrom, start, end))
            bases += end - start
    return intervals / bases if bases else 0.0


def effective_bin(reader, spans: dict[str, list[tuple[int, int]]], bin_size: int) -> int:
    """The bin to actually apply, which is none when the source is already coarser."""
    if bin_size <= 1:
        return 0
    return bin_size if density(reader, spans) * bin_size > BIN_WORTH_IT else 0


def _binned(reader, chrom: str, start: int, end: int, bin_size: int):
    """Return bin edges and mean signal values for one window.

    Compute means from the source records instead of its zoom summaries. A zoom summary may
    cross a requested bin edge and be assigned to the wrong side. Summing the records
    preserves the source signal within each bin.

    Each mean includes uncovered bases as zero. Averaging only covered bases would spread a
    short peak across the bin and inflate the total signal.
    """
    width = end - start
    bins = max(1, math.ceil(width / bin_size))
    edges = [start + index * width // bins for index in range(bins + 1)]
    totals = [0.0] * bins

    index = 0
    for record_start, record_end, value in reader.records(chrom, start, end):
        position, record_end = max(record_start, start), min(record_end, end)
        while position < record_end:
            while index + 1 < bins and edges[index + 1] <= position:
                index += 1
            edge = min(record_end, edges[index + 1])
            totals[index] += (edge - position) * value
            position = edge

    return edges, [total / (edges[i + 1] - edges[i]) for i, total in enumerate(totals)]


def read(reader, spans: dict[str, list[tuple[int, int]]], bin_size: int):
    """Yield ``(chrom, start, end, value)`` over the windows, binned when asked.

    Equal neighbouring bins are emitted as one interval, which is most of why a binned
    slice is so much smaller than the intervals it was reduced from.
    """
    for chrom in sorted(spans):
        for start, end in spans[chrom]:
            if not bin_size:
                for record_start, record_end, value in reader.records(chrom, start, end):
                    yield chrom, max(record_start, start), min(record_end, end), value
                continue

            edges, values = _binned(reader, chrom, start, end, bin_size)
            index = 0
            while index < len(values):
                value = values[index]
                run = index + 1
                while run < len(values) and values[run] == value:
                    run += 1
                if value != 0.0 and not math.isnan(value):
                    yield chrom, edges[index], edges[run], value
                index = run


def estimate(reader, spans: dict[str, list[tuple[int, int]]], bin_size: int) -> int:
    """Roughly how many bytes slicing these windows would write.

    Sampled rather than exact, because the point is to show the cost before paying it.
    """
    sampled = _sample(spans, SAMPLE_BASES)
    sampled_bases = sum(end - start for w in sampled.values() for start, end in w)
    if not sampled_bases:
        return 0
    items = sum(1 for _ in read(reader, sampled, bin_size))
    total_bases = sum(end - start for w in spans.values() for start, end in w)
    return int(items * total_bases / sampled_bases * BYTES_PER_ITEM)


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
