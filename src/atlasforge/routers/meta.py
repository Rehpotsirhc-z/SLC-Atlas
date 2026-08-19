# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends
from ..data.source import DataSource
from ..deps import get_source
from ..models.structure import DataSourceRecord

router = APIRouter()


@router.get(
    "/capabilities.json",
    response_model=dict[str, bool],
    summary="Which optional views this dataset was built with",
)
def get_capabilities(source: DataSource = Depends(get_source)):
    # The nav bar hides the tab of any view this reports as false
    return source.capabilities()


@router.get(
    "/sources.json",
    response_model=list[DataSourceRecord],
    summary="Where every dataset in this atlas came from, and under what license",
)
def get_sources(source: DataSource = Depends(get_source)):
    df = source.get_all_sources()
    return df.to_dicts() if df is not None else []
