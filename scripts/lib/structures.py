# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Shared structure vocabulary for the preprocess and build phases.

Which experimental entry counts as best decides both what preprocess mirrors and what
the build badges, so the rule lives here rather than in each phase.
"""

import polars as pl

PDB_MODEL_DEPTHS = ("none", "best", "all")


def rank_experimental(experimental: pl.DataFrame) -> pl.DataFrame:
    """Best resolved first. NMR and some cryo-EM entries report no resolution at all, and
    an unmeasured structure is not a better one, so they sort last."""
    return experimental.sort("resolution", nulls_last=True)


def best_per_gene(experimental: pl.DataFrame) -> pl.DataFrame:
    return rank_experimental(experimental).group_by("gene_id").agg(pl.col("pdb_id").first())
