# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Resolve coverage tracks and estimate the size of local copies."""

import csv
import multiprocessing
from pathlib import Path
from urllib.request import Request, urlopen

from ..lib import bigwig, chroms as chrom_names, console, interrupt, progress, windows
from ..lib.reporting import count, report_missing
from . import encode
from .browser_curation import TrackRow, pairs

WORKERS = 6

POLL_SECONDS = 0.2

HEADER = (
    "track_id",
    "label",
    "group",
    "strand",
    "source",
    "origin_url",
    "bin",
    "local",
    "citation",
    "url",
    "license_spdx",
    "chroms",
    "size_mismatch",
    "source_bytes",
    "local_bytes",
)


def resolve(source: str) -> tuple[str, str]:
    """Return the address to read a track at, and the origin the browser could use."""
    if encode.is_accession(source):
        url, _ = encode.resolve(source)
        return url, url
    if source.startswith(("http://", "https://")):
        return source, source
    path = Path(source).expanduser()
    if not path.exists():
        raise FileNotFoundError(f"No bigWig found at {path}")
    return str(path), ""


def remote_size(url: str) -> int:
    try:
        with urlopen(Request(url, method="HEAD"), timeout=30) as response:
            return int(response.headers.get("Content-Length") or 0)
    except Exception:
        return 0


def probe(
    row: TrackRow,
    spans: dict[str, list[tuple[int, int]]],
    sizes: dict[str, int],
    read_track,
    *,
    default_bin: int,
    default_local: bool,
    whole_genome: bool,
) -> dict:
    address, origin = resolve(row.source)
    local = row.local if row.local is not None else default_local
    if not local and not origin:
        raise SystemExit(
            f"Track {row.track_id!r} reads {row.source}, which is a file on this machine, so "
            f"it cannot be left where it is. Set its local column to yes, or give a URL."
        )

    size = remote_size(origin) if origin else Path(address).stat().st_size
    wanted = row.bin if row.bin is not None else default_bin
    read = read_track(
        address,
        spans,
        wanted,
        keep_local=local,
        whole_genome=whole_genome,
        source_bytes=size,
    )
    header = read["chroms"]
    present = sorted(name for name in spans if name in header)

    # A bigWig records no assembly, so a chromosome of the wrong length is the only sign
    # the track was built against a different genome than the genes were
    mismatch = [name for name in present if header[name] != sizes.get(name, header[name])]

    return {
        "track_id": row.track_id,
        "label": row.label,
        "group": row.group,
        "strand": row.strand,
        "source": row.source,
        "origin_url": origin,
        "bin": read["bin"],
        "local": "yes" if local else "no",
        "citation": row.citation,
        "url": row.url,
        "license_spdx": row.license_spdx,
        "chroms": ",".join(sorted(header)),
        "size_mismatch": ",".join(mismatch),
        "source_bytes": size,
        "local_bytes": read["local_bytes"],
        "_absent": sorted(set(spans) - set(present)),
    }


def _offloaded(measuring):
    """Hand a track's reading to the subprocess pool and wait for it answerably.

    The wait is a poll rather than a plain get so the thread comes back to `interrupt.check`
    between turns. A cancellation is a BaseException, so it passes straight through the
    per-track guard in `run` and out to the pool's own exit, which terminates the workers.
    """

    def read_track(address: str, spans: dict, bin_size: int, **flags):
        pending = measuring.apply_async(bigwig.measure, (address, spans, bin_size), flags)
        while True:
            interrupt.check()
            try:
                return pending.get(timeout=POLL_SECONDS)
            except multiprocessing.TimeoutError:
                continue

    return read_track


def write_table(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, HEADER, delimiter="\t", lineterminator="\n", extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)


def report(rows: list[dict], genes_by_chrom: dict[str, int]) -> None:
    for row in rows:
        absent = [name for name in row["_absent"] if genes_by_chrom.get(name)]
        if absent:
            genes = sum(genes_by_chrom[name] for name in absent)
            report_missing(
                "chromosome",
                f"that track {row['track_id']} does not carry, leaving "
                f"{count('gene', genes)} with no coverage on it",
                absent,
                limit=6,
            )
        if row["size_mismatch"]:
            console.detail(
                f"Track {row['track_id']} spells {row['size_mismatch']} at a different length "
                f"than the gene table does, so it was built on another genome. "
                f"The build will refuse it."
            )

    local = [r for r in rows if r["local"] == "yes"]
    console.detail(
        f"{count('coverage track', len(rows))} resolved, {len(local)} to be copied locally"
    )
    if local:
        total = sum(r["local_bytes"] for r in local)
        console.detail(
            f"Copying them adds roughly {total / 1024**2:.0f} MiB to the site. Run the "
            f"slice_coverage step to write them, or set local to no to leave them at "
            f"their origin."
        )


def run(
    tracks_path: Path,
    genes_path: Path,
    chroms_path: Path,
    out_path: Path,
    *,
    flank_min: int,
    flank_max: int,
    default_bin: int,
    default_local: bool,
    whole_genome: bool,
) -> None:
    from .curation import read_browser_tracks

    rows = read_browser_tracks(tracks_path)
    if not rows:
        console.detail(f"No coverage tracks named in {tracks_path}")
        write_table(out_path, [])
        return

    placed, _ = windows.load(genes_path, chroms_path, flank_min=flank_min, flank_max=flank_max)
    spans = windows.spans(
        genes_path,
        chroms_path,
        flank_min=flank_min,
        flank_max=flank_max,
        whole_genome=whole_genome,
    )
    sizes = chrom_names.sizes(chrom_names.read_chroms(chroms_path))
    genes_by_chrom: dict[str, int] = {}
    for window in placed:
        genes_by_chrom[window.chrom] = genes_by_chrom.get(window.chrom, 0) + 1

    jobs = [row for by_strand in pairs(rows).values() for _, row in sorted(by_strand.items())]

    # spawn rather than fork: by now the run is several steps' worth of threads deep, and a
    # fork would carry whatever locks they happen to hold into a child with no thread left
    # alive to release them
    context = multiprocessing.get_context("spawn")
    # Terminating on the way out is why this is a Pool: the workers are doing network reads
    # that nothing else can interrupt, and a canceled run must not leave them behind
    with (
        context.Pool(processes=max(1, min(WORKERS, len(jobs)))) as measuring,
        interrupt.closing(measuring.terminate),
    ):
        read_track = _offloaded(measuring)

        def attempt(row: TrackRow):
            try:
                return probe(
                    row,
                    spans,
                    sizes,
                    read_track,
                    default_bin=default_bin,
                    default_local=default_local,
                    whole_genome=whole_genome,
                )
            except SystemExit:
                raise
            except Exception as error:
                return f"{row.track_id} ({row.source}): {error}"

        with console.pool(WORKERS) as pool:
            results = list(progress.each(pool.map(attempt, jobs), len(jobs), "tracks", "lanes"))

    resolved = [r for r in results if isinstance(r, dict)]
    report_missing(
        "coverage track", "that could not be read", [r for r in results if isinstance(r, str)]
    )
    write_table(out_path, resolved)
    report(resolved, genes_by_chrom)
