# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The providers that a species tree can be built from.

Each provider is a function build(species, *, ensembl_release, curation_dir) that returns
the tree as a Newick string whose leaves are named after the ensembl_name of each species.
Ensembl Compara is the provider used unless another is chosen. The timetree and ucsc
providers read a Newick file that the user has put in the curation directory and rename
its leaves using the matching column of species.tsv. To add another provider, put its
build function in PROVIDERS.
"""

import io
import sys
from pathlib import Path

from ..lib.http import fetch_text

TIMETREE_FILENAME = "species_tree_timetree.nwk"
UCSC_FILENAME = "species_tree_ucsc.nwk"


def _tree_base(ensembl_release: int) -> str:
    return f"https://ftp.ensembl.org/pub/release-{ensembl_release}/compara/species_trees"


def _download(url: str) -> str:
    print(f"  downloading {url}", file=sys.stderr)
    return fetch_text(url)


def _match_ensembl(leaf_names: list[str], species: list[dict]) -> dict[str, str]:
    """Match each species to a leaf of an Ensembl or NCBI tree, and return the ensembl_name
    of the species that each leaf name belongs to.

    These trees name a leaf after the genus and species and then often the strain as well,
    with several strains of the same species appearing separately. Each species is
    therefore matched on the capitalized genus and species part of the name, and where
    that matches more than one leaf the one marked as the reference is taken.
    """
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
    """Match each species to a leaf of a TimeTree or UCSC tree, and return the ensembl_name
    of the species that each leaf name belongs to.

    A leaf of one of these trees matches a column of species.tsv exactly, once spaces,
    underscores and capitalization have been made consistent.
    """
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
    from Bio import Phylo

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
    from Bio import Phylo

    tree = Phylo.read(io.StringIO(_download(url)), "newick")
    chosen = _match_ensembl([leaf.name for leaf in tree.get_terminals()], species)
    return _finalize(tree, chosen)


def _from_curated(path: Path, species: list[dict], key: str, label: str) -> str:
    from Bio import Phylo

    if not path.exists():
        raise SystemExit(
            f"{label} source selected but {path} not found. Save a Newick covering the "
            f"species in species.tsv there (leaves named by the '{key}' column)."
        )
    tree = Phylo.read(path, "newick")
    chosen = _match_exact([leaf.name for leaf in tree.get_terminals()], species, key)
    return _finalize(tree, chosen)


def ensembl_compara(species: list[dict], *, ensembl_release: int, curation_dir: Path) -> str:
    url = f"{_tree_base(ensembl_release)}/vertebrates_species-tree_Ensembl.nh"
    return _from_ensembl_hosted(url, species)


def ncbi(species: list[dict], *, ensembl_release: int, curation_dir: Path) -> str:
    url = f"{_tree_base(ensembl_release)}/vertebrates_species-tree_NCBI_Taxonomy.nh"
    return _from_ensembl_hosted(url, species)


def timetree(species: list[dict], *, ensembl_release: int, curation_dir: Path) -> str:
    return _from_curated(curation_dir / TIMETREE_FILENAME, species, "timetree_name", "TimeTree")


def ucsc(species: list[dict], *, ensembl_release: int, curation_dir: Path) -> str:
    return _from_curated(curation_dir / UCSC_FILENAME, species, "ucsc_name", "UCSC")


PROVIDERS = {
    "ensembl_compara": ensembl_compara,
    "ncbi": ncbi,
    "timetree": timetree,
    "ucsc": ucsc,
}
DEFAULT = "ensembl_compara"
