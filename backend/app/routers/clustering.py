# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, Query
from ..deps import get_source
from ..data.parquet_source import ParquetSource
from ..models.clustering import ClusterNode

router = APIRouter()

_METHOD_PATTERN = "^(aa_sequence|dna_sequence|rna_coexpression_all|rna_coexpression_brain)$"


@router.get("/clustering", response_model=list[ClusterNode])
def get_clustering(
    method: str = Query("aa_sequence", pattern=_METHOD_PATTERN),
    source: ParquetSource = Depends(get_source),
):
    return source.get_clustering(method=method).to_dicts()
