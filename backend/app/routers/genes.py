from fastapi import APIRouter, Depends, HTTPException, Query
from ..deps import get_source
from ..data.parquet_source import ParquetSource
from ..models.gene import Gene, Transcript

router = APIRouter()


@router.get("/genes", response_model=list[Gene])
def list_genes(
    search: str | None = Query(None),
    source: ParquetSource = Depends(get_source),
):
    return source.get_genes(search=search).to_dicts()


@router.get("/genes/{gene_id}/transcripts", response_model=list[Transcript])
def list_transcripts(
    gene_id: str,
    source: ParquetSource = Depends(get_source),
):
    df = source.get_transcripts(gene_id)
    if df.is_empty():
        raise HTTPException(404, f"No transcripts found for {gene_id!r}")
    return df.to_dicts()
