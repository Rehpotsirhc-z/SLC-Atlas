# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Work out where each coverage track lives and what it would cost to keep a copy of it.

Nothing is copied here. Each track is resolved to an address, opened by byte range to read
its header, and sampled over a few of the family's windows to estimate how large a
family-scoped copy of it would be. That estimate is printed and written down, so the size
of the site is a decision made before the slicing runs rather than discovered afterwards.

A track that stays remote is read by the browser straight from its origin and adds nothing
to the site, which is only possible for a track that has an origin: a bigWig sitting on
this machine has to be copied to be served.
"""

import csv
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

from ..lib import bigwig, chroms as chrom_names, windows
from ..lib.reporting import count, report_missing
from . import encode
from .browser_curation import TrackRow, pairs

WORKERS = 6

HEADER = (
    "track_id",
    "label",
    "group",
    "strand",
    "source",
    "origin_url",
    "bin",
    "local",
    "chroms",
    "size_mismatch",
    "source_bytes",
    "window_bytes",
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
        raise FileNotFoundError(f"no bigWig at {path}")
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
    *,
    default_bin: int,
    default_local: bool,
) -> dict:
    address, origin = resolve(row.source)
    local = row.local if row.local is not None else default_local
    if not local and not origin:
        raise SystemExit(
            f"Track {row.track_id!r} reads {row.source}, which is a file on this machine, so "
            f"it cannot be left where it is. Set its local column to yes, or give a URL."
        )

    reader = bigwig.open_track(address)
    header = reader.chroms()
    present = sorted(name for name in spans if name in header)
    sampled = {name: spans[name] for name in present}
    wanted = row.bin if row.bin is not None else default_bin
    applied = bigwig.effective_bin(reader, sampled, wanted) if sampled else 0

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
        "bin": applied,
        "local": "yes" if local else "no",
        "chroms": ",".join(sorted(header)),
        "size_mismatch": ",".join(mismatch),
        "source_bytes": remote_size(origin) if origin else Path(address).stat().st_size,
        "window_bytes": bigwig.estimate(reader, sampled, applied) if local and sampled else 0,
        "_absent": sorted(set(spans) - set(present)),
    }


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
            print(
                f"Track {row['track_id']} spells {row['size_mismatch']} at a different length "
                f"than the gene table does, so it was built on another genome. "
                f"The build will refuse it.",
                file=sys.stderr,
            )

    local = [r for r in rows if r["local"] == "yes"]
    print(
        f"{count('coverage track', len(rows))} resolved, {len(local)} to be copied locally",
        file=sys.stderr,
    )
    if local:
        total = sum(r["window_bytes"] for r in local)
        print(
            f"Copying them adds roughly {total / 1024**2:.0f} MiB to the site. Run the "
            f"slice_coverage step to write them, or set local to no to leave them at "
            f"their origin.",
            file=sys.stderr,
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
) -> None:
    from .curation import read_browser_tracks

    rows = read_browser_tracks(tracks_path)
    if not rows:
        print(f"No coverage tracks named in {tracks_path}", file=sys.stderr)
        write_table(out_path, [])
        return

    placed, _ = windows.load(genes_path, chroms_path, flank_min=flank_min, flank_max=flank_max)
    spans = windows.merge(placed)
    sizes = chrom_names.sizes(chrom_names.read_chroms(chroms_path))
    genes_by_chrom: dict[str, int] = {}
    for window in placed:
        genes_by_chrom[window.chrom] = genes_by_chrom.get(window.chrom, 0) + 1

    jobs = [row for by_strand in pairs(rows).values() for _, row in sorted(by_strand.items())]

    def attempt(row: TrackRow):
        try:
            return probe(row, spans, sizes, default_bin=default_bin, default_local=default_local)
        except SystemExit:
            raise
        except Exception as error:
            return f"{row.track_id} ({row.source}): {error}"

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(attempt, jobs))

    resolved = [r for r in results if isinstance(r, dict)]
    report_missing(
        "coverage track", "that could not be read", [r for r in results if isinstance(r, str)]
    )
    write_table(out_path, resolved)
    report(resolved, genes_by_chrom)
