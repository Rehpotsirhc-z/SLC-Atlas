# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, Query
from ..deps import get_source
from ..data.parquet_source import ParquetSource

router = APIRouter()


@router.get("/clustering")
def get_clustering(
    method: str = Query("aa_sequence", pattern="^(aa_sequence|dna_sequence|rna_coexpression)$"),
    source: ParquetSource = Depends(get_source),
):
    return source.get_clustering(method=method).to_dicts()
