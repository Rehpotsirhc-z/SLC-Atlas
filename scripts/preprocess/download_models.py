# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Download the predicted-model coordinates named in structures.tsv.

Files already on disk are left alone, so re-running the pipeline after an unrelated
change costs nothing. Delete a file to refetch it, or the directory to refetch all.

Experimental PDB coordinates are deliberately not mirrored: 1800+ entries of mostly
cryo-EM complexes is a few hundred megabytes for a drill-down the viewer can stream
from PDBe on demand.
"""

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
    args = sys.argv[1:]
    structures_path = Path(args[0]) if len(args) > 0 else DEFAULT_STRUCTURES_PATH
    models_dir = Path(args[1]) if len(args) > 1 else DEFAULT_MODELS_DIR

    structures = pl.read_csv(structures_path, separator="\t").drop_nulls("model_url")
    models_dir.mkdir(parents=True, exist_ok=True)

    jobs = []
    for row in structures.unique(subset="uniprot_accession").iter_rows(named=True):
        path = models_dir / model_filename(row["uniprot_accession"], row["model_format"])
        if not path.exists():
            jobs.append((row["model_url"], path))

    on_disk = len(structures.unique(subset="uniprot_accession")) - len(jobs)
    print(f"{on_disk} model(s) already present; downloading {len(jobs)}", file=sys.stderr)

    if jobs:
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            failed = [stem for stem in pool.map(download, jobs) if stem]
        report_missing("model(s) failed to download", failed)

    total = sum(p.stat().st_size for p in models_dir.glob("*.*cif"))
    print(f"{len(list(models_dir.glob('*.*cif')))} models, {total / 1e6:.1f} MB in {models_dir}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
