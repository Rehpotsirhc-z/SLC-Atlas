# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the species dendrogram via a swappable source (see species_tree_sources.py;
default Ensembl Compara). Writes dataset/species_tree.nwk (leaves = Ensembl production
names) and the normalized dataset/species.tsv.

Prints the resulting leaf set so a species-name mismatch (the main failure mode when
swapping sources) is visible before the tree is consumed downstream.
"""

import csv
import io
import sys
from pathlib import Path

from Bio import Phylo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.reporting import report_missing
from species_tree_sources import DEFAULT, PROVIDERS

ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / "data" / "dataset"
DEFAULT_SPECIES_PATH = ROOT / "reference" / "species.tsv"
DEFAULT_OUT_PATH = DATASET_DIR / "species_tree.nwk"
DEFAULT_SPECIES_OUT_PATH = DATASET_DIR / "species.tsv"


def read_species(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def write_species_table(species: list[dict], out_path: Path) -> None:
    """Drop the curated cross-source columns, leaving the generic
    (species, species_label, taxon_id) contract the build consumes."""
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


def main() -> None:
    args = sys.argv[1:]
    source = args[0] if len(args) > 0 else DEFAULT
    species_path = Path(args[1]) if len(args) > 1 else DEFAULT_SPECIES_PATH
    out_path = Path(args[2]) if len(args) > 2 else DEFAULT_OUT_PATH

    if source not in PROVIDERS:
        raise SystemExit(f"Unknown source {source!r} (valid: {', '.join(PROVIDERS)})")

    species = read_species(species_path)
    print(f"[{source}] building tree for {len(species)} species", file=sys.stderr)
    newick = PROVIDERS[source](species)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(newick)
    write_species_table(species, DEFAULT_SPECIES_OUT_PATH)

    tree = Phylo.read(io.StringIO(newick), "newick")
    leaves = tree.get_terminals()
    print(f"\n{len(leaves)} leaves written -> {out_path}", file=sys.stderr)
    for leaf in leaves[:5]:
        print(f"  {leaf.name}: branch_length={leaf.branch_length}", file=sys.stderr)
    got = {leaf.name for leaf in leaves}
    report_missing("species not in tree", sorted({s["ensembl_name"] for s in species} - got))


if __name__ == "__main__":
    main()
