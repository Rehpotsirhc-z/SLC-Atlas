# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Build the species (column) dendrogram for the Conservation view.

The tree source is pluggable (see species_tree_sources.py): the default is Ensembl
Compara, with TimeTree / UCSC / NCBI as drop-in alternatives. Whatever the source, the
output is a single Newick at backend/data/raw/species_tree.nwk whose leaves are labeled
with Ensembl production names so 11_build_conservation.py can align it to the matrix.

This is a checkpoint step: it prints the resulting leaf set and a few branch lengths so a
species-name mismatch (the main failure mode when swapping sources) is obvious before the
tree is consumed downstream.

Usage:
    python scripts/10_fetch_species_tree.py [source] [species.tsv] [species_tree.nwk]
    # source defaults to 'ensembl_compara'; see species_tree_sources.PROVIDERS
"""

import csv
import io
import sys
from pathlib import Path

from Bio import Phylo

from species_tree_sources import DEFAULT, PROVIDERS

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SPECIES_PATH = SCRIPT_DIR.parent / "reference" / "species.tsv"
DEFAULT_OUT_PATH = SCRIPT_DIR.parent / "backend" / "data" / "raw" / "species_tree.nwk"


def read_species(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


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
    out_path.write_text(newick)

    # Checkpoint diagnostics
    tree = Phylo.read(io.StringIO(newick), "newick")
    leaves = tree.get_terminals()
    requested = {s["ensembl_name"] for s in species}
    got = {leaf.name for leaf in leaves}
    print(f"\n{len(leaves)} leaves written -> {out_path}", file=sys.stderr)
    for leaf in leaves[:5]:
        print(f"  {leaf.name}: branch_length={leaf.branch_length}", file=sys.stderr)
    missing = requested - got
    if missing:
        print(f"WARNING: {len(missing)} species not in tree: {sorted(missing)}", file=sys.stderr)


if __name__ == "__main__":
    main()
