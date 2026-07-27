# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends
from ..data.source import DataSource
from ..deps import get_source

router = APIRouter()


@router.get("/capabilities", response_model=dict[str, bool])
def get_capabilities(source: DataSource = Depends(get_source)):
    """Which optional views this dataset was built with, so the nav can hide the rest."""
    return source.capabilities()
