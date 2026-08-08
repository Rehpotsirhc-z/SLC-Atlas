# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Download a local copy of every PDB entry listed in experimental.tsv, which the
--download-experimental flag asks for.

A file that is already on disk is left alone, so running the pipeline again after an
unrelated change downloads nothing. Delete a file to fetch it again, or the whole
directory to fetch all of them again.

The coordinates are downloaded from RCSB rather than from the model_url in
experimental.tsv. RCSB serves binary CIF, which is about half the size of the plain CIF
PDBe serves, and its URLs do not carry a release version that could later stop working.
The viewer can stream the same files from RCSB while the app is running, so keeping local
copies is a choice about how the app is deployed and never one the app depends on.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl

from ..lib.http import fetch_bytes
from ..lib.reporting import count, report_missing

COORDINATE_URL = "https://models.rcsb.org/{pdb_id}.bcif"
WORKERS = 6


def download(job: tuple[str, Path]) -> str | None:
    url, path = job
    try:
        path.write_bytes(fetch_bytes(url))
    except Exception as exc:
        print(f"  failed {path.name}: {exc}", file=sys.stderr)
        return path.stem
    return None


def run(experimental_path: Path, models_dir: Path) -> None:
    if not experimental_path.exists():
        print(f"no {experimental_path}; nothing to mirror", file=sys.stderr)
        return

    experimental = pl.read_csv(
        experimental_path,
        separator="\t",
        columns=["pdb_id"],
        schema_overrides={"pdb_id": pl.Utf8},
    ).drop_nulls("pdb_id")
    models_dir.mkdir(parents=True, exist_ok=True)

    # 3D-Beacons lists a PDB entry once for every gene that it covers
    pdb_ids = experimental["pdb_id"].unique().sort().to_list()
    jobs = []
    for pdb_id in pdb_ids:
        path = models_dir / f"{pdb_id}.bcif"
        if not path.exists():
            jobs.append((COORDINATE_URL.format(pdb_id=pdb_id), path))

    on_disk = len(pdb_ids) - len(jobs)
    print(
        f"{count('entry/entries', on_disk)} already present; downloading {len(jobs)}",
        file=sys.stderr,
    )

    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            failed = [stem for stem in pool.map(download, jobs) if stem]
        report_missing("experimental entry/experimental entries", "that failed to download", failed)

    mirrored = list(models_dir.glob("*.bcif"))
    total = sum(p.stat().st_size for p in mirrored)
    print(f"{len(mirrored)} entries, {total / 1e6:.1f} MB in {models_dir}", file=sys.stderr)
