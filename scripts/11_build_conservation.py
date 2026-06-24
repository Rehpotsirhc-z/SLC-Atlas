# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Assemble the Conservation view's served Parquet files.

Inputs (curated + fetched):
  reference/species.tsv              curated species list (committed)
  backend/data/raw/orthologs.tsv     output of 09_fetch_orthologs.py
  backend/data/raw/species_tree.nwk  output of 10_fetch_species_tree.py
  backend/data/genes.parquet         symbol/family for each gene

Outputs (served, not committed):
  backend/data/conservation.parquet  dense gene x species matrix, one row per pair
                                     (null metrics where no ortholog exists). Human is
                                     included as a 100%-identity self column so the matrix
                                     columns line up with the species-tree leaves.
  backend/data/species_tree.parquet  flat node table mirroring clustering.parquet
                                     (node_id, parent_id, branch_length, species, ...).

Usage:
    python scripts/11_build_conservation.py
"""

import csv
import sys
from pathlib import Path

import polars as pl
from Bio import Phylo

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent / "backend" / "data"
RAW_DIR = DATA_DIR / "raw"
SPECIES_PATH = SCRIPT_DIR.parent / "reference" / "species.tsv"
ORTHOLOGS_PATH = RAW_DIR / "orthologs.tsv"
TREE_PATH = RAW_DIR / "species_tree.nwk"
GENES_PATH = DATA_DIR / "genes.parquet"
CONSERVATION_OUT = DATA_DIR / "conservation.parquet"
SPECIES_TREE_OUT = DATA_DIR / "species_tree.parquet"

CONSERVATION_SCHEMA = {
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "family": pl.Utf8,
    "species": pl.Utf8,
    "species_label": pl.Utf8,
    "perc_id": pl.Float64,
    "perc_id_r1": pl.Float64,
    "perc_pos": pl.Float64,
    "dn_ds": pl.Float64,
    "orthology_type": pl.Utf8,
    "ortholog_count": pl.Int64,
    "target_gene_id": pl.Utf8,
}

SPECIES_TREE_SCHEMA = {
    "node_id": pl.Int64,
    "parent_id": pl.Int64,
    "branch_length": pl.Float64,
    "species": pl.Utf8,
    "species_label": pl.Utf8,
    "taxon_id": pl.Int64,
}


def _f(v: str | None) -> float | None:
    return float(v) if v not in (None, "") else None


def read_species() -> list[dict]:
    with open(SPECIES_PATH, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_orthologs() -> dict[tuple[str, str], dict]:
    with open(ORTHOLOGS_PATH, encoding="utf-8") as f:
        return {(r["gene_id"], r["species"]): r for r in csv.DictReader(f, delimiter="\t")}


def build_matrix(species: list[dict], orthologs: dict[tuple[str, str], dict]) -> list[dict]:
    genes = pl.read_parquet(GENES_PATH, columns=["id", "symbol", "family"])
    rows = []
    for g in genes.iter_rows(named=True):
        gid = g["id"]
        for sp in species:
            en = sp["ensembl_name"]
            base = {
                "gene_id": gid,
                "symbol": g["symbol"],
                "family": g["family"],
                "species": en,
                "species_label": sp["display_name"],
            }
            if en == "homo_sapiens":  # reference self column
                rows.append({**base, "perc_id": 100.0, "perc_id_r1": 100.0, "perc_pos": 100.0,
                             "dn_ds": None, "orthology_type": "self", "ortholog_count": 1,
                             "target_gene_id": gid})
                continue
            o = orthologs.get((gid, en))
            if o is None:
                rows.append({**base, "perc_id": None, "perc_id_r1": None, "perc_pos": None,
                             "dn_ds": None, "orthology_type": None, "ortholog_count": 0,
                             "target_gene_id": None})
            else:
                rows.append({**base, "perc_id": _f(o["perc_id"]), "perc_id_r1": _f(o["perc_id_r1"]),
                             "perc_pos": _f(o["perc_pos"]), "dn_ds": _f(o["dn_ds"]),
                             "orthology_type": o["orthology_type"] or None,
                             "ortholog_count": int(o["ortholog_count"]),
                             "target_gene_id": o["target_gene_id"] or None})
    return rows


def build_species_tree(species: list[dict]) -> list[dict]:
    label = {s["ensembl_name"]: s["display_name"] for s in species}
    taxon = {s["ensembl_name"]: int(s["taxon_id"]) for s in species}

    tree = Phylo.read(TREE_PATH, "newick")
    clades = list(tree.find_clades())
    id_of = {id(c): i for i, c in enumerate(clades)}
    parent_of: dict[int, int] = {}
    for c in clades:
        for child in c.clades:
            parent_of[id(child)] = id_of[id(c)]

    rows = []
    for c in clades:
        leaf = c.is_terminal()
        rows.append(
            {
                "node_id": id_of[id(c)],
                "parent_id": parent_of.get(id(c)),
                "branch_length": float(c.branch_length or 0.0),
                "species": c.name if leaf else None,
                "species_label": label.get(c.name) if leaf else None,
                "taxon_id": taxon.get(c.name) if leaf else None,
            }
        )
    return rows


def main() -> None:
    species = read_species()
    orthologs = read_orthologs()

    matrix = build_matrix(species, orthologs)
    pl.DataFrame(matrix, schema=CONSERVATION_SCHEMA).write_parquet(CONSERVATION_OUT)
    n_genes = len({r["gene_id"] for r in matrix})
    print(f"wrote {len(matrix)} rows ({n_genes} genes x {len(species)} species) -> {CONSERVATION_OUT}",
          file=sys.stderr)

    tree_rows = build_species_tree(species)
    pl.DataFrame(tree_rows, schema=SPECIES_TREE_SCHEMA).write_parquet(SPECIES_TREE_OUT)
    n_leaves = sum(1 for r in tree_rows if r["species"])
    print(f"wrote {len(tree_rows)} nodes ({n_leaves} leaves) -> {SPECIES_TREE_OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
