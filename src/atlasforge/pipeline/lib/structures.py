# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The rule that decides which experimental structure is the best one for a gene."""

import polars as pl


def rank_experimental(experimental: pl.DataFrame) -> pl.DataFrame:
    """Sort the entries by resolution, with the best resolved one first. NMR entries and
    some cryo-EM entries report no resolution at all, and those are sorted to the end."""
    return experimental.sort("resolution", nulls_last=True)
