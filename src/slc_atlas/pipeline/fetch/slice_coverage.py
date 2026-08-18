# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Create local bigWig copies of coverage tracks for the browser."""

import csv
import shutil
from pathlib import Path

from ..lib import bigwig, console, paths, progress, windows
from ..lib.http import download
from ..lib.reporting import count, report_missing
from .fetch_coverage import resolve

# The writer runs its own threads, so a few tracks at once fills the machine without
# oversubscribing it
WORKERS = 4


def read_table(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def wanted(rows: list[dict]) -> list[dict]:
    return [row for row in rows if row.get("local") == "yes" and not row.get("size_mismatch")]


def check_budget(rows: list[dict], max_bytes: int) -> None:
    total = sum(int(row.get("local_bytes") or 0) for row in rows)
    if not max_bytes or total <= max_bytes:
        return
    over = -(-total // max_bytes)
    raise SystemExit(
        f"Copying these {count('track', len(rows))} would add about {total / 1024**2:.0f} MiB to "
        f"the site, over the {max_bytes / 1024**2:.0f} MiB limit. Either raise "
        f"--browser-max-bytes, or coarsen the tracks with a --browser-bin about {over} times "
        f"larger, or slice them to the family's windows by dropping --browser-whole-genome, "
        f"and run the fetch_coverage step again; or set some rows in the coverage curation "
        f"file to local no so they are read from their origin instead."
    )


def fetch_whole(address: str, target: Path) -> str:
    """Copy or download a whole track without rewriting it."""
    written = target.with_suffix(".partial.bw")
    if address.startswith(("http://", "https://")):
        with progress.bytes_bar(target.name) as on_bytes:
            download(address, written, on_bytes)
    else:
        shutil.copy2(address, written)
    written.replace(target)
    return f"{target.name}: {target.stat().st_size / 1024**2:.1f} MiB, taken whole"


def slice_track(
    row: dict,
    spans: dict[str, list[tuple[int, int]]],
    out_dir: Path,
    *,
    whole_genome: bool,
) -> str:
    target = out_dir / paths.track_filename(row["track_id"], row["strand"])
    if target.exists():
        return f"kept {target.name}"

    address, _ = resolve(row["source"])
    bin_size = int(row.get("bin") or 0)
    if whole_genome and not bin_size:
        return fetch_whole(address, target)

    reader = bigwig.open_track(address)
    header = reader.chroms()
    # Limit output to chromosomes present in both the retained spans and source track
    present = {name: spans[name] for name in spans if name in header}
    sizes = {name: header[name] for name in present}

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
    whole_genome: bool,
) -> None:
    rows = wanted(read_table(coverage_path))
    if not rows:
        console.detail("No coverage tracks are set to be copied locally")
        return

    check_budget(rows, max_bytes)
    spans = windows.spans(
        genes_path,
        chroms_path,
        flank_min=flank_min,
        flank_max=flank_max,
        whole_genome=whole_genome,
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    def attempt(row: dict):
        try:
            return slice_track(row, spans, out_dir, whole_genome=whole_genome)
        except Exception as error:
            return RuntimeError(f"{row['track_id']}: {error}")

    with console.pool(WORKERS) as pool:
        results = list(progress.each(pool.map(attempt, rows), len(rows), "copying tracks", "lanes"))

    for result in results:
        if isinstance(result, str):
            console.detail(result)
    report_missing(
        "coverage track",
        "that could not be copied",
        [str(r) for r in results if not isinstance(r, str)],
    )

    total = sum(p.stat().st_size for p in out_dir.glob("*.bw"))
    console.detail(
        f"{count('coverage track', len(list(out_dir.glob('*.bw'))))} in {out_dir}, "
        f"{total / 1024**2:.0f} MiB"
    )
