# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the orthologs of each gene in the curated species from Ensembl Compara, through
the homology endpoint of the Ensembl REST API.

For each species only the ortholog with the highest percentage identity is kept, along
with a count of how many orthologs that species has. The result has one row for every
combination of gene and species that has an ortholog at all, and build_conservation.py
turns it into a grid with a cell for every combination.

The species are sent as a repeated target_species filter so that Compara answers with the
twenty or so species that are wanted rather than all two hundred it knows about.
"""

import csv
import sys
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

import polars as pl

from ..lib.http import get_json
from ..lib.reporting import report_missing

REST = "https://rest.ensembl.org"
WORKERS = 4

FIELDS = [
    "gene_id",
    "species",
    "target_gene_id",
    "perc_id",  # Percentage of the target that is identical to the human gene
    "perc_id_r1",  # Percentage of the human gene that is identical to the target
    "perc_pos",  # Percentage of the target that is positionally similar to the human gene
    "orthology_type",
    "ortholog_count",  # How many orthologs this species has, always at least one
]


def read_species(path: Path) -> list[str]:
    with open(path, encoding="utf-8") as f:
        data = (line for line in f if line.strip() and not line.startswith("#"))
        return [row["ensembl_name"] for row in csv.DictReader(data, delimiter="\t")]


def fetch_gene(gene_id: str, species: list[str]) -> list[dict]:
    targets = "".join(f";target_species={s}" for s in species)
    # Ensembl's own value for this parameter
    # cspell:ignore orthologues
    url = (
        f"{REST}/homology/id/human/{gene_id}"
        f"?type=orthologues;format=full;aligned=0;sequence=none;compara=vertebrates"
        f";content-type=application/json{targets}"
    )
    payload = get_json(url, absent=(400, 404))  # Compara does not know about this gene
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


def run(genes_path: Path, species_path: Path, out_path: Path) -> None:
    species = read_species(species_path)
    targets = [s for s in species if s != "homo_sapiens"]  # A gene is not an ortholog of itself
    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()
    print(f"{len(gene_ids)} genes across {len(targets)} target species", file=sys.stderr)

    all_rows: list[dict] = []
    missing = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = pool.map(partial(fetch_gene, species=targets), gene_ids)
        for i, (gid, rows) in enumerate(zip(gene_ids, results), 1):
            if not rows:
                missing.append(gid)
            all_rows.extend(rows)
            if i % 50 == 0:
                print(f"  {i}/{len(gene_ids)} genes...", file=sys.stderr)

    # Coverage per species flags species-name mismatches fast
    print("\nOrtholog coverage per species:", file=sys.stderr)
    for sp in targets:
        n = sum(1 for r in all_rows if r["species"] == sp)
        flag = "  <-- ZERO, check ensembl_name" if n == 0 else ""
        print(f"  {sp:30s} {n:4d} genes{flag}", file=sys.stderr)
    report_missing("gene", "with no ortholog in any species", missing)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\nWrote {len(all_rows)} ortholog rows -> {out_path}", file=sys.stderr)
