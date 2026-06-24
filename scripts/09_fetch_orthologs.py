# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch cross-species orthologs for every gene in genes.parquet from the Ensembl
REST homology endpoint (Compara), restricted to the curated species in species.tsv.

For each human gene we query /homology/id/human/{id} with type=orthologues and the
species list passed as repeated target_species filters (keeps the payload to our ~20
species instead of Compara's ~200). Among the orthologs in each species we keep the one
with the highest target protein %identity, and also record how many orthologs that
species has (one2many duplications are common in the SLC family).

Writes backend/data/raw/orthologs.tsv with one row per (gene, species) that has at least
one ortholog. Species with no ortholog get no row here; the dense gene x species grid is
filled in by 11_build_conservation.py.

Usage:
    python scripts/09_fetch_orthologs.py [genes.parquet] [species.tsv] [orthologs.tsv]
"""

import csv
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import polars as pl

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "backend" / "data"
DEFAULT_GENES_PATH = DATA_DIR / "genes.parquet"
DEFAULT_SPECIES_PATH = SCRIPT_DIR.parent / "reference" / "species.tsv"
DEFAULT_OUT_PATH = DATA_DIR / "raw" / "orthologs.tsv"

REST = "https://rest.ensembl.org"

FIELDS = [
    "gene_id",
    "species",
    "target_gene_id",
    "target_protein_id",
    "perc_id",  # % of target identical to human
    "perc_id_r1",  # % of human identical to target
    "perc_pos",  # % of target positionally similar to human
    "dn_ds",  # Compara dN/dS (often null for distant species)
    "orthology_type",
    "ortholog_count",  # number of orthologs in this species (>= 1)
]


def read_species(path: Path) -> list[str]:
    with open(path, encoding="utf-8") as f:
        return [row["ensembl_name"] for row in csv.DictReader(f, delimiter="\t")]


def _get(url: str) -> object | None:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    for _ in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:  # rate limited
                time.sleep(int(e.headers.get("Retry-After", "2")) + 1)
                continue
            if e.code in (400, 404):  # gene absent from Compara
                return None
            raise
    raise RuntimeError(f"giving up on {url} after repeated 429s")


def fetch_gene(gene_id: str, species: list[str]) -> list[dict]:
    targets = "".join(f";target_species={s}" for s in species)
    url = (
        f"{REST}/homology/id/human/{gene_id}"
        f"?type=orthologues;format=full;aligned=0;sequence=none;compara=vertebrates"
        f";content-type=application/json{targets}"
    )
    payload = _get(url)
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
                "target_protein_id": tgt.get("protein_id"),
                "perc_id": tgt.get("perc_id"),
                "perc_id_r1": best["source"].get("perc_id"),
                "perc_pos": tgt.get("perc_pos"),
                "dn_ds": best.get("dn_ds"),
                "orthology_type": best.get("type"),
                "ortholog_count": len(homs),
            }
        )
    return rows


def main() -> None:
    args = sys.argv[1:]
    genes_path = Path(args[0]) if len(args) > 0 else DEFAULT_GENES_PATH
    species_path = Path(args[1]) if len(args) > 1 else DEFAULT_SPECIES_PATH
    out_path = Path(args[2]) if len(args) > 2 else DEFAULT_OUT_PATH

    species = read_species(species_path)
    targets = [s for s in species if s != "homo_sapiens"]  # no self-orthologs
    gene_ids = pl.read_parquet(genes_path, columns=["id"])["id"].to_list()
    print(f"{len(gene_ids)} genes x {len(targets)} target species", file=sys.stderr)

    all_rows: list[dict] = []
    missing = []
    for i, gid in enumerate(gene_ids, 1):
        rows = fetch_gene(gid, targets)
        if not rows:
            missing.append(gid)
        all_rows.extend(rows)
        if i % 50 == 0:
            print(f"  {i}/{len(gene_ids)} genes...", file=sys.stderr)
        time.sleep(0.2)  # stay under Ensembl's 15 req/s

    # Diagnostics: ortholog coverage per species (flags species-name mismatches fast)
    print("\northolog coverage per species:", file=sys.stderr)
    for sp in targets:
        n = sum(1 for r in all_rows if r["species"] == sp)
        flag = "  <-- ZERO, check ensembl_name" if n == 0 else ""
        print(f"  {sp:30s} {n:4d} genes{flag}", file=sys.stderr)
    if missing:
        print(f"\n{len(missing)} gene(s) with no orthologs in any species:", file=sys.stderr)
        for g in missing:
            print(f"  {g}", file=sys.stderr)

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\nwrote {len(all_rows)} ortholog rows -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
