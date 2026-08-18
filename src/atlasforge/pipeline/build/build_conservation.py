# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build conservation.parquet and species_tree.parquet from the source files.

The first holds a cell for every combination of gene and species, and the second holds one
row per node of the species tree.

The reference species, which is human, is added as a column of its own in which every gene
is a hundred percent identical to itself, so that the columns of the matrix and the leaves
of the species tree are the same set of species.
"""

import csv
from pathlib import Path

import polars as pl

from ..lib import parquet
from ..lib import console

from ..lib.reporting import report_missing

REFERENCE_SPECIES = "homo_sapiens"

CONSERVATION_SCHEMA = {
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "family": pl.Utf8,
    "species": pl.Utf8,
    "species_label": pl.Utf8,
    "perc_id": pl.Float64,
    "perc_id_r1": pl.Float64,
    "perc_pos": pl.Float64,
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


def read_species(species_path: Path) -> list[dict]:
    with open(species_path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_orthologs(orthologs_path: Path) -> dict[tuple[str, str], dict]:
    with open(orthologs_path, encoding="utf-8") as f:
        return {(r["gene_id"], r["species"]): r for r in csv.DictReader(f, delimiter="\t")}


def build_matrix(
    genes_path: Path, species: list[dict], orthologs: dict[tuple[str, str], dict]
) -> list[dict]:
    genes = pl.read_csv(genes_path, separator="\t", columns=["id", "symbol", "family"])
    rows = []
    for g in genes.iter_rows(named=True):
        gid = g["id"]
        for sp in species:
            en = sp["species"]
            base = {
                "gene_id": gid,
                "symbol": g["symbol"],
                "family": g["family"],
                "species": en,
                "species_label": sp["species_label"],
            }
            if en == REFERENCE_SPECIES:  # The column where each gene is compared to itself
                rows.append(
                    {
                        **base,
                        "perc_id": 100.0,
                        "perc_id_r1": 100.0,
                        "perc_pos": 100.0,
                        "orthology_type": "self",
                        "ortholog_count": 1,
                        "target_gene_id": gid,
                    }
                )
                continue
            o = orthologs.get((gid, en))
            if o is None:
                rows.append(
                    {
                        **base,
                        "perc_id": None,
                        "perc_id_r1": None,
                        "perc_pos": None,
                        "orthology_type": None,
                        "ortholog_count": 0,
                        "target_gene_id": None,
                    }
                )
            else:
                rows.append(
                    {
                        **base,
                        "perc_id": _f(o["perc_id"]),
                        "perc_id_r1": _f(o["perc_id_r1"]),
                        "perc_pos": _f(o["perc_pos"]),
                        "orthology_type": o["orthology_type"] or None,
                        "ortholog_count": int(o["ortholog_count"]),
                        "target_gene_id": o["target_gene_id"] or None,
                    }
                )
    return rows


def ladderize_reference_first(clade, reference: str) -> None:
    """Order every split so that the larger subtree comes first, and where the two are the
    same size put the one holding the reference species first, which brings that species to
    the left-hand edge of the drawn tree."""
    for child in clade.clades:
        ladderize_reference_first(child, reference)
    clade.clades.sort(
        key=lambda c: (c.count_terminals(), any(t.name == reference for t in c.get_terminals()))
    )
    clade.clades.reverse()


def build_species_tree(tree_path: Path, species: list[dict]) -> list[dict]:
    from Bio import Phylo

    label = {s["species"]: s["species_label"] for s in species}
    taxon = {s["species"]: int(s["taxon_id"]) for s in species}

    tree = Phylo.read(tree_path, "newick")
    ladderize_reference_first(tree.root, REFERENCE_SPECIES)
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


def run(source_dir: Path, out_dir: Path) -> None:
    species_path = source_dir / "species.tsv"
    orthologs_path = source_dir / "orthologs.tsv"
    tree_path = source_dir / "species_tree.nwk"
    genes_path = source_dir / "genes.tsv"
    conservation_out = out_dir / "conservation.parquet"
    species_tree_out = out_dir / "species_tree.parquet"

    species = read_species(species_path)
    orthologs = read_orthologs(orthologs_path)

    out_dir.mkdir(parents=True, exist_ok=True)

    matrix = build_matrix(genes_path, species, orthologs)
    parquet.write(pl.DataFrame(matrix, schema=CONSERVATION_SCHEMA), conservation_out)
    n_genes = len({r["gene_id"] for r in matrix})
    with_any = {
        r["gene_id"]
        for r in matrix
        if r["ortholog_count"] and r["species"] != REFERENCE_SPECIES
    }
    report_missing(
        "gene",
        "with no ortholog in any species, drawn as an empty row",
        sorted({r["gene_id"] for r in matrix} - with_any),
        checked=n_genes,
        clean="every gene has an ortholog in at least one species",
    )
    console.success(f"Wrote {len(matrix)} rows, {n_genes} genes across {len(species)} species "
        f"-> {conservation_out}")

    tree_rows = build_species_tree(tree_path, species)
    parquet.write(pl.DataFrame(tree_rows, schema=SPECIES_TREE_SCHEMA), species_tree_out)
    n_leaves = sum(1 for r in tree_rows if r["species"])
    console.success(f"Wrote {len(tree_rows)} nodes ({n_leaves} leaves) -> {species_tree_out}")
