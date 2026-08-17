# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the tree of the species that the dataset compares genes across.

The tree can come from any of the providers in species_tree_sources.py, and Ensembl
Compara is the one used unless another is chosen. The tree is written to
source/species_tree.nwk, with each leaf named after an Ensembl production name, and the
species themselves are written to source/species.tsv.

The leaves of the finished tree are printed, because a species whose name does not match
is by far the most common thing to go wrong when the provider is changed, and printing
them shows it before anything else reads the tree.
"""

import csv
import io
from pathlib import Path

from ..lib import console
from ..lib.reporting import report_missing
from .species_tree_sources import PROVIDERS


def read_species(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        data = (line for line in f if line.strip() and not line.startswith("#"))
        return list(csv.DictReader(data, delimiter="\t"))


def write_species_table(species: list[dict], out_path: Path) -> None:
    """Write out the species, keeping only the species, species_label and taxon_id columns
    that the build reads and leaving behind the curated name columns each provider uses."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=["species", "species_label", "taxon_id"], delimiter="\t"
        )
        writer.writeheader()
        for s in species:
            writer.writerow(
                {
                    "species": s["ensembl_name"],
                    "species_label": s["display_name"],
                    "taxon_id": s["taxon_id"],
                }
            )


def run(
    source: str,
    species_path: Path,
    tree_out: Path,
    species_table_out: Path,
    *,
    ensembl_release: int,
    curation_dir: Path,
) -> None:
    from Bio import Phylo

    if source not in PROVIDERS:
        raise SystemExit(f"Unknown source {source!r} (valid: {', '.join(PROVIDERS)})")

    species = read_species(species_path)
    console.detail(f"Building a tree for {len(species)} species from {source}")
    newick = PROVIDERS[source](species, ensembl_release=ensembl_release, curation_dir=curation_dir)
    tree_out.parent.mkdir(parents=True, exist_ok=True)
    tree_out.write_text(newick)
    write_species_table(species, species_table_out)

    tree = Phylo.read(io.StringIO(newick), "newick")
    leaves = tree.get_terminals()
    console.success(f"Wrote {len(leaves)} species -> {tree_out}")
    got = {leaf.name for leaf in leaves}
    report_missing(
        "species/species", "not in the tree", sorted({s["ensembl_name"] for s in species} - got)
    )
