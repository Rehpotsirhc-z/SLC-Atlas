# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""The columns that the gene tables in the source files are made up of.

This sits outside both phases of the pipeline. The fetch phase writes these columns and
the build phase reads them, and neither of them imports anything from the other.
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
