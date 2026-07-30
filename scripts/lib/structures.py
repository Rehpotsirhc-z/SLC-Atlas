# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Shared structure vocabulary.

Which experimental entry counts as best is what the build badges each gene with, so the
rule lives here rather than inside the build step.
"""

import polars as pl


def rank_experimental(experimental: pl.DataFrame) -> pl.DataFrame:
    """Best resolved first. NMR and some cryo-EM entries report no resolution at all, and
    an unmeasured structure is not a better one, so they sort last."""
    return experimental.sort("resolution", nulls_last=True)
