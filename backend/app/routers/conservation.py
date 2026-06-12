# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, Query
from ..deps import get_source
from ..data.parquet_source import ParquetSource

router = APIRouter()


@router.get("/conservation")
def get_conservation(
    gene_ids: list[str] | None = Query(None),
    source: ParquetSource = Depends(get_source),
):
    return source.get_conservation(gene_ids=gene_ids).to_dicts()
