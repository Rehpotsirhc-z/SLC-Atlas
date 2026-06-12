# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, Query
from ..deps import get_source
from ..data.parquet_source import ParquetSource

router = APIRouter()


@router.get("/expression")
def get_expression(
    gene_id: str | None = Query(None),
    modality: str = Query("rna", pattern="^(rna|protein)$"),
    source: ParquetSource = Depends(get_source),
):
    return source.get_expression(gene_id=gene_id, modality=modality).to_dicts()
