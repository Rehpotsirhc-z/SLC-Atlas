# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Write a family-scoped copy of each coverage track that the site is to serve itself.

A published coverage file covers the whole genome, and the atlas draws a few percent of it,
so what gets copied is only the windows around the family's genes. The copy is a bigWig
like the original, keeps its own pyramid of reduced views, and is read by byte range, so
one file still answers every zoom the browser asks for without a server behind it.

The source may be remote, in which case only the windows are ever pulled across the network
and a four gigabyte track is sliced without being downloaded.

A track already written is left alone, so a run interrupted part way through resumes.
"""

import csv
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..lib import bigwig, windows
from ..lib.reporting import count, report_missing
from .fetch_coverage import resolve

# The writer runs its own threads, so a few tracks at once fills the machine without
# oversubscribing it
WORKERS = 4


def track_filename(track_id: str, strand: str) -> str:
    return f"{track_id}.{strand}.bw" if strand else f"{track_id}.bw"


def read_table(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def wanted(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row.get("local") == "yes" and not row.get("size_mismatch")]


def check_budget(rows: list[dict], max_bytes: int) -> None:
    total = sum(int(row.get("window_bytes") or 0) for row in rows)
    if not max_bytes or total <= max_bytes:
        return
    over = -(-total // max_bytes)
    raise SystemExit(
        f"Copying these {count('track', len(rows))} would add about {total / 1024**2:.0f} MiB to "
        f"the site, over the {max_bytes / 1024**2:.0f} MiB limit. Either raise "
        f"--browser-max-bytes, or coarsen the tracks with a --browser-bin about {over} times "
        f"larger and run the fetch_coverage step again, or set some rows in the coverage "
        f"curation file to local no so they are read from their origin instead."
    )


def slice_track(row: dict, spans: dict[str, list[tuple[int, int]]], out_dir: Path) -> str:
    target = out_dir / track_filename(row["track_id"], row["strand"])
    if target.exists():
        return f"kept {target.name}"

    address, _ = resolve(row["source"])
    reader = bigwig.open_track(address)
    header = reader.chroms()
    # Only the chromosomes that both the windows and this track have, so the file never
    # promises a region it holds no data for
    present = {name: spans[name] for name in spans if name in header}
    sizes = {name: header[name] for name in present}
    bin_size = int(row.get("bin") or 0)

    written = target.with_suffix(".partial.bw")
    items, _ = bigwig.write(written, sizes, bigwig.read(reader, present, bin_size))
    written.replace(target)
    return (
        f"{target.name}: {target.stat().st_size / 1024**2:.1f} MiB, {count('interval', items)}"
        + (f", binned to {bin_size} bases" if bin_size else ", at source resolution")
    )


def run(
    coverage_path: Path,
    genes_path: Path,
    chroms_path: Path,
    out_dir: Path,
    *,
    flank_min: int,
    flank_max: int,
    max_bytes: int,
) -> None:
    rows = wanted(read_table(coverage_path))
    if not rows:
        print("No coverage tracks are set to be copied locally", file=sys.stderr)
        return

    check_budget(rows, max_bytes)
    placed, _ = windows.load(genes_path, chroms_path, flank_min=flank_min, flank_max=flank_max)
    spans = windows.merge(placed)
    out_dir.mkdir(parents=True, exist_ok=True)

    def attempt(row: dict):
        try:
            return slice_track(row, spans, out_dir)
        except Exception as error:
            return RuntimeError(f"{row['track_id']}: {error}")

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(attempt, rows))

    for result in results:
        if isinstance(result, str):
            print(result, file=sys.stderr)
    report_missing(
        "coverage track",
        "that could not be copied",
        [str(r) for r in results if not isinstance(r, str)],
    )

    total = sum(p.stat().st_size for p in out_dir.glob("*.bw"))
    print(
        f"{count('coverage track', len(list(out_dir.glob('*.bw'))))} in {out_dir}, "
        f"{total / 1024**2:.0f} MiB",
        file=sys.stderr,
    )
