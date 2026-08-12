# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Write a table the app reads one gene at a time so that a read can skip most of it.

A parquet reader can drop a whole row group without decoding it when the group's recorded
minimum and maximum rule out the value being filtered for. That only helps if the rows of
one gene sit together, so the table is sorted by gene, and if there is more than one group
to choose between, so the group size is given rather than left to the writer, which puts a
table of a few tens of thousands of rows in a single group that every read then decodes
whole.

The right group size depends on how wide a row is and how many rows a gene has, so each
table names its own: small enough that one gene's rows touch few groups, large enough that
the extra group headers and the shorter compression runs stay cheap. Ordering the rows this
way is not a promise to whoever reads them; every endpoint that cares about the order of
what it returns still sorts it.
"""

from pathlib import Path

import polars as pl


def write_gene_keyed(frame: pl.DataFrame, path: Path, *keys: str, row_group: int) -> None:
    """Sort by the given key columns, the first of which is the gene, and write in row groups
    of the given size."""
    frame.sort(*keys).write_parquet(path, row_group_size=row_group, statistics=True)
