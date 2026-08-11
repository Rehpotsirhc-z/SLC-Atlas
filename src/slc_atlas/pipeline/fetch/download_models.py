# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Download a local copy of the predicted-model coordinates listed in structures.tsv,
which the --download-predicted flag asks for.

A file that is already on disk is left alone, so running the pipeline again after an
unrelated change downloads nothing. Delete a file to fetch it again, or the whole
directory to fetch all of them again.

Without the flag nothing is downloaded and the viewer streams the models from AlphaFold DB
instead. It works out the current URL as it loads each one, because the URL stored here
names a particular AlphaFold release and stops working when a new one comes out.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import polars as pl

from ..lib.http import fetch_bytes
from ..lib.reporting import count, report_missing

WORKERS = 6


def model_filename(accession: str, model_format: str | None) -> str:
    return f"{accession}.{'bcif' if model_format == 'BCIF' else 'cif'}"


def download(job: tuple[str, Path]) -> str | None:
    url, path = job
    try:
        path.write_bytes(fetch_bytes(url))
    except Exception as exc:
        print(f"  Failed {path.name}: {exc}", file=sys.stderr)
        return path.stem
    return None


def run(structures_path: Path, models_dir: Path) -> None:
    structures = pl.read_csv(structures_path, separator="\t").drop_nulls("model_url")
    models_dir.mkdir(parents=True, exist_ok=True)

    jobs = []
    for row in structures.unique(subset="uniprot_accession").iter_rows(named=True):
        path = models_dir / model_filename(row["uniprot_accession"], row["model_format"])
        if not path.exists():
            jobs.append((row["model_url"], path))

    on_disk = len(structures.unique(subset="uniprot_accession")) - len(jobs)
    print(f"{count('model', on_disk)} already present; downloading {len(jobs)}", file=sys.stderr)

    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            failed = [stem for stem in pool.map(download, jobs) if stem]
        report_missing("model", "that failed to download", failed)

    mirrored = list(models_dir.glob("*.*cif"))
    total = sum(p.stat().st_size for p in mirrored)
    print(f"{len(mirrored)} models, {total / 1024**2:.1f} MiB in {models_dir}", file=sys.stderr)
