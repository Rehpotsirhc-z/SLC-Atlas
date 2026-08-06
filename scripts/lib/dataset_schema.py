# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Column contract for the standard-format gene tables in data/dataset/.

Lives outside both phases: preprocess writes these columns, build reads them, and
neither imports the other.
"""

import polars as pl

GENE_SCHEMA = {
    "id": pl.Utf8,
    "symbol": pl.Utf8,
    "name": pl.Utf8,
    "chromosome": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "strand": pl.Utf8,
    "length": pl.Int64,
    "alias": pl.Utf8,
    "category": pl.Utf8,
    "family": pl.Utf8,
    "family_name": pl.Utf8,
    "function_brief": pl.Utf8,
}

TRANSCRIPT_SCHEMA = {
    "id": pl.Utf8,
    "gene_id": pl.Utf8,
    "name": pl.Utf8,
    "type": pl.Utf8,
    "start": pl.Int64,
    "end": pl.Int64,
    "length": pl.Int64,
}
