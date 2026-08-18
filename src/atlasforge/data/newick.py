# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from collections.abc import Sequence
import polars as pl


def adjacency_to_newick(
    df: pl.DataFrame, label_cols: Sequence[str], include_root_branch: bool
) -> str:
    """Serialize node_id/parent_id adjacency rows as Newick, labeling each node
    with the first non-empty column of `label_cols`."""
    if df.is_empty():
        return ""

    children: dict[int, list[int]] = {}
    label: dict[int, str] = {}
    length: dict[int, float] = {}
    root: int | None = None
    for row in df.iter_rows(named=True):
        nid = row["node_id"]
        length[nid] = row["branch_length"] or 0.0
        label[nid] = next((row[col] for col in label_cols if row[col]), "")
        pid = row["parent_id"]
        if pid is None:
            root = nid
        else:
            children.setdefault(pid, []).append(nid)

    if root is None:
        return ""

    rendered: dict[int, str] = {}
    stack: list[tuple[int, bool]] = [(root, False)]
    while stack:
        nid, children_done = stack.pop()
        kids = children.get(nid)
        if not kids:
            rendered[nid] = f"{label[nid]}:{length[nid]:.5f}"
        elif children_done:
            rendered[nid] = "(" + ",".join(rendered[k] for k in kids) + f"):{length[nid]:.5f}"
        else:
            stack.append((nid, True))
            stack.extend((k, False) for k in kids)

    if include_root_branch:
        return rendered[root] + ";\n"
    return "(" + ",".join(rendered[k] for k in children.get(root, [])) + ");\n"
