# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Read, resample, estimate, and write bigWig coverage tracks."""

import math
from pathlib import Path

import numpy as np

BYTES_PER_ITEM = 9

SAMPLE_BASES = 4_000_000

SAMPLE_PIECES = 24

REDUCTION_SAMPLES = 8

# Include neighboring columns to detect summary spillover
REDUCTION_BINS = 100
REDUCTION_MIN_BINS = 8

REDUCTION_MAX_WINDOW = 1_000_000

REDUCTION_MAX_SPAN = 1 << 20

REDUCTION_TOLERANCE = 0.05

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
    """Yield coverage intervals, optionally merging equal neighboring bins."""
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


def measure(
    address: str,
    spans: dict[str, list[tuple[int, int]]],
    bin_size: int,
    *,
    keep_local: bool,
    whole_genome: bool,
    source_bytes: int,
) -> dict:
    """Collect track metadata and size estimates in a subprocess-friendly call."""
    reader = open_track(address)
    header = reader.chroms()
    present = {name: spans[name] for name in spans if name in header}
    applied = effective_bin(reader, present, bin_size) if present else 0
    if not keep_local:
        kept = 0
    elif whole_genome and not applied:
        kept = source_bytes
    else:
        kept = estimate(reader, present, applied) if present else 0
    return {"chroms": header, "bin": applied, "local_bytes": kept}


def _check_windows(sizes: dict[str, int], width: int) -> list[tuple[str, int, int]]:
    """Spread test windows across the largest chromosomes, including gaps."""
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
    """Check that summaries do not invent signal absent from exact records."""
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
    """Return the finest trustworthy summary width, or zero when none qualify."""
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
