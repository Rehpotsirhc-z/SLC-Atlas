# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Swappable species-tree providers for the Conservation view's column dendrogram.

Each provider is a function ``build(species) -> newick_str`` where ``species`` is the
list of rows from ``species.tsv``. Every provider returns a Newick whose leaves are
labeled with the Ensembl production name (the ``ensembl_name`` column), so everything
downstream is provider-agnostic.

The default is Ensembl Compara (same source as the orthologs, fully automated).
TimeTree, UCSC and NCBI are drop-in alternatives: to swap, pass the provider
name to ``10_fetch_species_tree.py`` (e.g. ``timetree``). TimeTree/UCSC read a
curated Newick committed under reference/ and remap its leaves via the matching
column in species.tsv. To add a new source, write a ``build`` function and
register it in ``PROVIDERS``.
"""

import io
import sys
import urllib.request
from pathlib import Path

from Bio import Phylo

SCRIPT_DIR = Path(__file__).resolve().parent

# Pinned to the release the rest of the atlas uses
ENSEMBL_RELEASE = 116
_TREE_BASE = f"https://ftp.ensembl.org/pub/release-{ENSEMBL_RELEASE}/compara/species_trees"
ENSEMBL_TREE_URL = f"{_TREE_BASE}/vertebrates_species-tree_Ensembl.nh"
NCBI_TREE_URL = f"{_TREE_BASE}/vertebrates_species-tree_NCBI_Taxonomy.nh"

# Curated Newicks for the manual sources; committed under reference/ when used.
REFERENCE_DIR = SCRIPT_DIR.parent / "reference"
TIMETREE_NWK = REFERENCE_DIR / "species_tree_timetree.nwk"
UCSC_NWK = REFERENCE_DIR / "species_tree_ucsc.nwk"


def _fetch(url: str) -> str:
    print(f"  downloading {url}", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=120) as resp:
        return resp.read().decode("utf-8")


def _match_ensembl(leaf_names: list[str], species: list[dict]) -> dict[str, str]:
    """Ensembl/NCBI trees label leaves 'Genus_species[_strain...]', often with several
    strains per species. Match each species by its capitalized 'Genus_species' prefix,
    preferring the leaf marked 'reference'. Returns {tree_leaf_name: ensembl_name}."""
    chosen: dict[str, str] = {}
    for sp in species:
        en = sp["ensembl_name"]
        parts = en.split("_")
        prefix = parts[0].capitalize() + "_" + "_".join(parts[1:])
        cands = [n for n in leaf_names if n == prefix or n.startswith(prefix + "_")]
        if not cands:
            print(f"  no tree leaf for {en}", file=sys.stderr)
            continue
        ref = [c for c in cands if "reference" in c.lower()]
        chosen[(ref or sorted(cands, key=len))[0]] = en
    return chosen


def _match_exact(leaf_names: list[str], species: list[dict], key: str) -> dict[str, str]:
    """Curated trees (TimeTree/UCSC) match a species.tsv column exactly, normalizing
    spaces/underscores/case. Returns {tree_leaf_name: ensembl_name}."""
    norm = lambda s: s.strip().lower().replace(" ", "_")
    index = {norm(n): n for n in leaf_names}
    chosen: dict[str, str] = {}
    for sp in species:
        leaf = index.get(norm(sp.get(key, "")))
        if leaf is None:
            print(
                f"  no tree leaf for {sp['ensembl_name']} ({key}={sp.get(key)!r})", file=sys.stderr
            )
            continue
        chosen[leaf] = sp["ensembl_name"]
    return chosen


def _finalize(tree, chosen: dict[str, str]) -> str:
    """Prune the tree to the chosen leaves and relabel them to ensembl_name."""
    keep = set(chosen)
    for leaf in tree.get_terminals():
        if leaf.name not in keep:
            tree.prune(leaf)
    for leaf in tree.get_terminals():
        leaf.name = chosen[leaf.name]
    buf = io.StringIO()
    Phylo.write(tree, buf, "newick")
    return buf.getvalue()


def _from_ensembl_hosted(url: str, species: list[dict]) -> str:
    tree = Phylo.read(io.StringIO(_fetch(url)), "newick")
    chosen = _match_ensembl([leaf.name for leaf in tree.get_terminals()], species)
    return _finalize(tree, chosen)


def _from_curated(path: Path, species: list[dict], key: str, label: str) -> str:
    if not path.exists():
        raise SystemExit(
            f"{label} source selected but {path} not found. Save a Newick covering the "
            f"species in species.tsv there (leaves named by the '{key}' column)."
        )
    tree = Phylo.read(path, "newick")
    chosen = _match_exact([leaf.name for leaf in tree.get_terminals()], species, key)
    return _finalize(tree, chosen)


def ensembl_compara(species: list[dict]) -> str:
    return _from_ensembl_hosted(ENSEMBL_TREE_URL, species)


def ncbi(species: list[dict]) -> str:
    return _from_ensembl_hosted(NCBI_TREE_URL, species)


def timetree(species: list[dict]) -> str:
    return _from_curated(TIMETREE_NWK, species, "timetree_name", "TimeTree")


def ucsc(species: list[dict]) -> str:
    return _from_curated(UCSC_NWK, species, "ucsc_name", "UCSC")


PROVIDERS = {
    "ensembl_compara": ensembl_compara,
    "ncbi": ncbi,
    "timetree": timetree,
    "ucsc": ucsc,
}
DEFAULT = "ensembl_compara"
