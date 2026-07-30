# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Mirror the predicted-model coordinates named in structures.tsv, under --download-predicted.

Files already on disk are left alone, so re-running the pipeline after an unrelated
change costs nothing. Delete a file to refetch it, or the directory to refetch all.

Without the flag nothing is mirrored and the viewer streams from AlphaFold DB, resolving
the current URL as it loads because the one stored here pins a release version.
"""

import argparse
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.http import fetch_bytes
from lib.reporting import report_missing

STRUCTURE_DIR = Path(__file__).resolve().parents[2] / "backend" / "data" / "dataset" / "structure"
DEFAULT_STRUCTURES_PATH = STRUCTURE_DIR / "structures.tsv"
DEFAULT_MODELS_DIR = STRUCTURE_DIR / "models"

WORKERS = 6


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    parser.add_argument("structures", nargs="?", type=Path, default=DEFAULT_STRUCTURES_PATH)
    parser.add_argument("models_dir", nargs="?", type=Path, default=DEFAULT_MODELS_DIR)
    parser.add_argument("--download-predicted", action="store_true")
    return parser.parse_args()


def model_filename(accession: str, model_format: str | None) -> str:
    return f"{accession}.{'bcif' if model_format == 'BCIF' else 'cif'}"


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
    if not args.download_predicted:
        print("streaming predicted models; mirroring none", file=sys.stderr)
        return

    structures = pl.read_csv(args.structures, separator="\t").drop_nulls("model_url")
    args.models_dir.mkdir(parents=True, exist_ok=True)

    jobs = []
    for row in structures.unique(subset="uniprot_accession").iter_rows(named=True):
        path = args.models_dir / model_filename(row["uniprot_accession"], row["model_format"])
        if not path.exists():
            jobs.append((row["model_url"], path))

    on_disk = len(structures.unique(subset="uniprot_accession")) - len(jobs)
    print(f"{on_disk} model(s) already present; downloading {len(jobs)}", file=sys.stderr)

    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            failed = [stem for stem in pool.map(download, jobs) if stem]
        report_missing("model(s) failed to download", failed)

    mirrored = list(args.models_dir.glob("*.*cif"))
    total = sum(p.stat().st_size for p in mirrored)
    print(f"{len(mirrored)} models, {total / 1e6:.1f} MB in {args.models_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
