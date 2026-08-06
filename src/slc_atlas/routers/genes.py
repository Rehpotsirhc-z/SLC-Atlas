# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, HTTPException
from ..data.source import DataSource
from ..deps import get_source
from ..models.gene import Gene, Transcript

router = APIRouter()


@router.get("/genes.json", response_model=list[Gene])
def list_genes(source: DataSource = Depends(get_source)):
    return source.get_genes().to_dicts()


@router.get("/genes/{gene_id}/transcripts.json", response_model=list[Transcript])
def list_transcripts(
    gene_id: str,
    source: DataSource = Depends(get_source),
):
    df = source.get_transcripts(gene_id)
    if df.is_empty():
        raise HTTPException(404, f"No transcripts found for {gene_id!r}")
    return df.to_dicts()
