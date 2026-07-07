# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, HTTPException, Query
from ..deps import get_source
from ..data.parquet_source import ParquetSource
from ..models.expression import ExpressionCell

router = APIRouter()


@router.get("/expression", response_model=list[ExpressionCell])
def get_expression(
    gene_id: str | None = Query(None),
    modality: str = Query("rna", pattern="^(rna|protein)$"),
    tissue_scope: str = Query("all", pattern="^(all|brain)$"),
    source: ParquetSource = Depends(get_source),
):
    if modality == "protein":
        raise HTTPException(status_code=501, detail="Protein abundance data is not yet available")
    return source.get_expression(gene_id=gene_id, modality=modality, tissue_scope=tissue_scope).to_dicts()
