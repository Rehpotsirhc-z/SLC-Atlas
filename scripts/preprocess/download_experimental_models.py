# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Mirror every PDB entry named in experimental.tsv, under --download-experimental.

Files already on disk are left alone, so re-running the pipeline after an unrelated
change costs nothing. Delete a file to refetch it, or the directory to refetch all.

Coordinates come from RCSB rather than the model_url in experimental.tsv: RCSB serves
binary CIF, about half the size of PDBe's plain CIF, and its URLs carry no release
version to rot. The viewer streams from the same host at runtime, so mirroring is a
deployment choice and never a correctness one.
"""

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import fetch_bytes
from lib.reporting import report_missing

STRUCTURE_DIR = Path(__file__).resolve().parents[2] / "data" / "dataset" / "structure"
DEFAULT_EXPERIMENTAL_PATH = STRUCTURE_DIR / "experimental.tsv"
DEFAULT_MODELS_DIR = STRUCTURE_DIR / "models" / "pdb"

COORDINATE_URL = "https://models.rcsb.org/{pdb_id}.bcif"
WORKERS = 6


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("experimental", nargs="?", type=Path, default=DEFAULT_EXPERIMENTAL_PATH)
    parser.add_argument("models_dir", nargs="?", type=Path, default=DEFAULT_MODELS_DIR)
    parser.add_argument("--download-experimental", action="store_true")
    return parser.parse_args()


def download(job: tuple[str, Path]) -> str | None:
    url, path = job
    try:
        path.write_bytes(fetch_bytes(url))
    except Exception as exc:
        print(f"  failed {path.name}: {exc}", file=sys.stderr)
        return path.stem
    return None


def main() -> None:
    args = parse_args()
    if not args.download_experimental:
        print("streaming experimental coordinates; mirroring none", file=sys.stderr)
        return
    if not args.experimental.exists():
        print(f"no {args.experimental}; nothing to mirror", file=sys.stderr)
        return

    experimental = pl.read_csv(
        args.experimental,
        separator="\t",
        columns=["pdb_id"],
        schema_overrides={"pdb_id": pl.Utf8},
    ).drop_nulls("pdb_id")
    args.models_dir.mkdir(parents=True, exist_ok=True)

    # 3D-Beacons reports an entry once per gene it covers
    pdb_ids = experimental["pdb_id"].unique().sort().to_list()
    jobs = []
    for pdb_id in pdb_ids:
        path = args.models_dir / f"{pdb_id}.bcif"
        if not path.exists():
            jobs.append((COORDINATE_URL.format(pdb_id=pdb_id), path))

    on_disk = len(pdb_ids) - len(jobs)
    print(f"{on_disk} entry(s) already present; downloading {len(jobs)}", file=sys.stderr)

    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            failed = [stem for stem in pool.map(download, jobs) if stem]
        report_missing("experimental entry(s) failed to download", failed)

    mirrored = list(args.models_dir.glob("*.bcif"))
    total = sum(p.stat().st_size for p in mirrored)
    print(f"{len(mirrored)} entries, {total / 1e6:.1f} MB in {args.models_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
