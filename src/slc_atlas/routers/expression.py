# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends
from ..data.source import DataSource
from ..deps import get_source
from ..models.expression import ExpressionCell, TissueScope

router = APIRouter()


@router.get("/expression/{tissue_scope}.json", response_model=list[ExpressionCell])
def get_expression(
    tissue_scope: TissueScope,
    source: DataSource = Depends(get_source),
):
    return source.get_expression(tissue_scope=tissue_scope).to_dicts()
