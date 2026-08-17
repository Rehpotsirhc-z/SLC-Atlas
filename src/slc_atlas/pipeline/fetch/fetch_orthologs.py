# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch and cache orthologs from Ensembl Compara."""

import csv
import hashlib
import json
import threading
from functools import partial
from pathlib import Path

import polars as pl

from ..lib import console, progress
from ..lib.http import get_json
from ..lib.reporting import FAILURE, count, report_missing

REST = "https://rest.ensembl.org"
WORKERS = 4
CACHE_NAME = "orthologs_fetched.jsonl"

FIELDS = [
    "gene_id",
    "species",
    "target_gene_id",
    "perc_id",
    "perc_id_r1",
    "perc_pos",
    "orthology_type",
    "ortholog_count",
]


def read_species(path: Path) -> list[str]:
    with open(path, encoding="utf-8") as f:
        data = (line for line in f if line.strip() and not line.startswith("#"))
        return [row["ensembl_name"] for row in csv.DictReader(data, delimiter="\t")]


def fetch_gene(gene_id: str, species: list[str]) -> list[dict]:
    targets = "".join(f";target_species={s}" for s in species)
    # cspell:ignore orthologues
    url = (
        f"{REST}/homology/id/human/{gene_id}"
        f"?type=orthologues;format=full;aligned=0;sequence=none;compara=vertebrates"
        f";content-type=application/json{targets}"
    )
    payload = get_json(url, absent=(400, 404))
    if not payload or not payload.get("data"):
        return []

    by_species: dict[str, list[dict]] = {}
    for h in payload["data"][0].get("homologies", []):
        if not h.get("type", "").startswith("ortholog"):
            continue
        tgt = h["target"]
        by_species.setdefault(tgt["species"], []).append(h)

    rows = []
    for sp, homs in by_species.items():
        best = max(homs, key=lambda h: h["target"].get("perc_id") or 0.0)
        tgt = best["target"]
        rows.append(
            {
                "gene_id": gene_id,
                "species": sp,
                "target_gene_id": tgt.get("id"),
                "perc_id": tgt.get("perc_id"),
                "perc_id_r1": best["source"].get("perc_id"),
                "perc_pos": tgt.get("perc_pos"),
                "orthology_type": best.get("type"),
                "ortholog_count": len(homs),
            }
        )
    return rows


def _stamp(species: list[str]) -> str:
    """What the cached answers were asked for, so a changed species list invalidates them."""
    return hashlib.sha256("\n".join(sorted(species)).encode()).hexdigest()[:16]


class Cache:
    """One line per gene already fetched, appended as each answer arrives.

    A gene with no orthologs is stored as an empty list rather than left out, so the fact
    that it was asked is remembered and it is not asked again on every later run.
    """

    def __init__(self, path: Path, species: list[str]) -> None:
        self.path = path
        self.stamp = _stamp(species)
        self.lock = threading.Lock()
        self.handle = None

    def read(self) -> dict[str, list[dict]]:
        if not self.path.exists():
            return {}
        done: dict[str, list[dict]] = {}
        header = True
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue  # A run killed mid-write leaves a torn last line
            if header:
                header = False
                if record.get("species_stamp") != self.stamp:
                    return {}  # Asked for a different set of species, so none of it answers now
                continue
            done[record["gene_id"]] = record["rows"]
        return done

    def open(self, seed: dict[str, list[dict]]) -> None:
        """Start the cache from what is already known, so the file always matches the stamp."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            handle.write(json.dumps({"species_stamp": self.stamp}) + "\n")
            for gene_id, rows in seed.items():
                handle.write(json.dumps({"gene_id": gene_id, "rows": rows}) + "\n")
        self.handle = self.path.open("a", encoding="utf-8")

    def add(self, gene_id: str, rows: list[dict]) -> None:
        with self.lock:
            if self.handle is None:
                return
            self.handle.write(json.dumps({"gene_id": gene_id, "rows": rows}) + "\n")
            self.handle.flush()

    def close(self) -> None:
        if self.handle is not None:
            self.handle.close()
            self.handle = None


# A previous orthologs.tsv is deliberately not read back as a cache. It records neither which
# genes were asked for nor which species they were filtered to, so a gene absent from it could
# equally have no orthologs or never have been fetched, and a species added since could not be
# noticed. Rebuilding from the file would quietly present an incomplete answer as a complete
# one, which is worse than refetching a cache the docs already call safe to delete.


def _coverage(targets: list[str], rows: list[dict]) -> None:
    """Per-species counts, which is how a mistyped ensembl_name shows itself."""
    console.detail("Ortholog coverage per species:")
    empty = []
    for sp in targets:
        n = sum(1 for r in rows if r["species"] == sp)
        console.detail(f"{sp:30s} {n:4d} genes", indent=2)
        if n == 0:
            empty.append(sp)
    report_missing("species", "with no ortholog for any gene, so check its ensembl_name", empty)


def run(genes_path: Path, species_path: Path, out_path: Path, cache_dir: Path) -> None:
    species = read_species(species_path)
    targets = [s for s in species if s != "homo_sapiens"]  # A gene is not an ortholog of itself
    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()

    cache = Cache(cache_dir / CACHE_NAME, targets)
    done = cache.read()
    pending = [gene for gene in gene_ids if gene not in done]
    console.detail(f"{len(gene_ids)} genes across {len(targets)} target species")
    if done:
        console.detail(f"{count('gene', len(done))} already fetched, {len(pending)} to go")
    elif cache.path.exists():
        console.note("The species list has changed since the last run, so all genes are fetched")

    refused: list[str] = []
    cache.open(done)
    try:
        if pending:
            _fetch_pending(pending, targets, cache, done, refused)
    finally:
        cache.close()

    all_rows = [row for gene in gene_ids for row in done.get(gene, [])]
    _coverage(targets, all_rows)
    report_missing(
        "gene",
        "whose orthologs Ensembl would not give up, so they are missing until the next run",
        refused,
        severity=FAILURE,
        checked=len(gene_ids),
    )
    report_missing(
        "gene",
        "with no ortholog in any species",
        [gene for gene in gene_ids if gene in done and not done[gene]],
        checked=len(gene_ids),
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        writer.writeheader()
        writer.writerows(all_rows)
    console.success(f"Wrote {count('ortholog row', len(all_rows))} -> {out_path}")


def _fetch_pending(
    pending: list[str],
    targets: list[str],
    cache: "Cache",
    done: dict[str, list[dict]],
    refused: list[str],
) -> None:
    """Ask for each gene still missing, keeping whatever comes back.

    A gene Compara will not answer for is recorded and skipped rather than ending the step,
    so one bad morning at Ensembl costs those genes and not the whole family.
    """

    with progress.bar("orthologs", total=len(pending), noun="genes") as bar:
        with console.pool(WORKERS) as pool:
            for gene_id, rows in pool.map(partial(_safe, species=targets), pending):
                bar.advance()
                if rows is None:
                    refused.append(gene_id)
                    continue
                done[gene_id] = rows
                cache.add(gene_id, rows)


def _safe(gene_id: str, species: list[str]) -> tuple[str, list[dict] | None]:
    try:
        return gene_id, fetch_gene(gene_id, species)
    except SystemExit:
        raise
    except Exception as error:
        console.warn(f"{gene_id}: {error}", indent=2)
        return gene_id, None
