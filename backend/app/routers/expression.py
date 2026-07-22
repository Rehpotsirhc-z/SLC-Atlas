# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, Query
from ..data.source import DataSource
from ..deps import get_source
from ..models.expression import ExpressionCell

router = APIRouter()


@router.get("/expression", response_model=list[ExpressionCell])
def get_expression(
    tissue_scope: str = Query("all", pattern="^(all|brain)$"),
    source: DataSource = Depends(get_source),
):
    return source.get_expression(tissue_scope=tissue_scope).to_dicts()
