# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Serialize a clustering into the flat node table clustering.parquet stores.

One row per node (method, node_id, parent_id, branch_length, gene_id, symbol, family)
so the API can return a tree without a Newick parser on the client. Internal nodes have
null gene_id/symbol/family; the root has null parent_id. Each builder also returns the
equivalent Newick for inspection.
"""

import re

import numpy as np
import polars as pl
from scipy.cluster.hierarchy import linkage, to_tree
from scipy.spatial.distance import squareform

CLUSTERING_SCHEMA = {
    "method": pl.Utf8,
    "node_id": pl.Int64,
    "parent_id": pl.Int64,
    "branch_length": pl.Float64,
    "gene_id": pl.Utf8,
    "symbol": pl.Utf8,
    "family": pl.Utf8,
}


def natural_key(s: str) -> list:
    """Chunk a label into text/number runs so SLC2 sorts before SLC10."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def family_grouping(gene_ids: list[str], meta: dict[str, dict]) -> tuple[list[dict], str]:
    """Flat grouping: root -> one node per family -> gene leaves.

    Branch lengths are zero because this expresses family membership, not distance.
    """
    fam_to_genes: dict[str, list[str]] = {}
    for gid in gene_ids:
        fam = meta.get(gid, {}).get("family") or "Unassigned"
        fam_to_genes.setdefault(fam, []).append(gid)

    rows: list[dict] = []
    next_id = 0

    def add(parent_id: int | None, gid: str | None = None) -> int:
        nonlocal next_id
        node_id = next_id
        next_id += 1
        m = meta.get(gid, {}) if gid else {}
        rows.append(
            {
                "method": "family_grouping",
                "node_id": node_id,
                "parent_id": parent_id,
                "branch_length": 0.0,
                "gene_id": gid,
                "symbol": m.get("symbol") if gid else None,
                "family": m.get("family") if gid else None,
            }
        )
        return node_id

    root_id = add(None)
    fam_parts: list[str] = []
    for fam in sorted(fam_to_genes, key=natural_key):
        fam_id = add(root_id)
        genes = sorted(
            fam_to_genes[fam], key=lambda g: natural_key(meta.get(g, {}).get("symbol") or g)
        )
        leaf_parts = []
        for gid in genes:
            add(fam_id, gid)
            leaf_parts.append(f"{meta.get(gid, {}).get('symbol') or gid}:0.00000")
        fam_parts.append("(" + ",".join(leaf_parts) + "):0.00000")
    newick = "(" + ",".join(fam_parts) + ");"
    return rows, newick


def tree_rows(
    labels: list[str], dist: np.ndarray, meta: dict[str, dict], method: str
) -> tuple[list[dict], str]:
    """UPGMA linkage, ladderized larger-subtree-first at every split.

    That mirror of a plain smaller-first ladder keeps basal branches together while
    putting the denser clades at the top of the row order. node_ids follow the resulting
    preorder so sibling order is stable however the client reads the table.
    """
    z = linkage(squareform(dist, checks=False), method="average")
    root = to_tree(z)

    rows: list[dict] = []
    next_id = 0

    def visit(node, parent_id: int | None, parent_dist: float) -> str:
        nonlocal next_id
        node_id = next_id
        next_id += 1
        bl = max(0.0, parent_dist - node.dist) if parent_id is not None else 0.0
        if node.is_leaf():
            gid = labels[node.id]
            m = meta.get(gid, {})
            rows.append(
                {
                    "method": method,
                    "node_id": node_id,
                    "parent_id": parent_id,
                    "branch_length": bl,
                    "gene_id": gid,
                    "symbol": m.get("symbol"),
                    "family": m.get("family"),
                }
            )
            return f"{gid}:{bl:.5f}"
        rows.append(
            {
                "method": method,
                "node_id": node_id,
                "parent_id": parent_id,
                "branch_length": bl,
                "gene_id": None,
                "symbol": None,
                "family": None,
            }
        )
        kids = sorted([node.get_left(), node.get_right()], key=lambda c: c.count)[::-1]
        parts = [visit(c, node_id, node.dist) for c in kids]
        return f"({','.join(parts)}):{bl:.5f}"

    newick = visit(root, None, 0.0) + ";"
    return rows, newick
