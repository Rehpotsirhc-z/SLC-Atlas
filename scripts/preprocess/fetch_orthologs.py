# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch cross-species orthologs from the Ensembl REST homology endpoint (Compara),
restricted to the species in reference/species.tsv.

Keeps the highest-%identity ortholog per species plus the ortholog count, one row per
(gene, species) with an ortholog; the dense grid is filled in by build_conservation.py.
The species list is passed as repeated target_species filters to keep Compara's payload
to our ~20 species instead of ~200.
"""

import csv
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import polars as pl

ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / "backend" / "data" / "dataset"
DEFAULT_GENES_PATH = DATASET_DIR / "genes.tsv"
DEFAULT_SPECIES_PATH = ROOT / "reference" / "species.tsv"
DEFAULT_OUT_PATH = DATASET_DIR / "orthologs.tsv"

REST = "https://rest.ensembl.org"

FIELDS = [
    "gene_id",
    "species",
    "target_gene_id",
    "target_protein_id",
    "perc_id",  # % of target identical to human
    "perc_id_r1",  # % of human identical to target
    "perc_pos",  # % of target positionally similar to human
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
    gene_ids = pl.read_csv(genes_path, separator="\t", columns=["id"])["id"].to_list()
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

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\nwrote {len(all_rows)} ortholog rows -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
