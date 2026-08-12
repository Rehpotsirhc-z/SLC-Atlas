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
            runs = np.concatenate(
                ([0], np.flatnonzero(np.diff(values)) + 1, [values.size])
            ).astype(np.int64)
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
