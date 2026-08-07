# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

import polars as pl
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from ..data.source import DataSource
from ..deps import get_source
from ..models.structure import (
    DataSourceRecord,
    ExperimentalStructure,
    GeneTopology,
    ProteinFeature,
    Structure,
    StructureDetail,
)

router = APIRouter()

UNAVAILABLE = "Structure data is not built for this dataset"


def require(df: pl.DataFrame | None) -> pl.DataFrame:
    if df is None:
        raise HTTPException(404, UNAVAILABLE)
    return df


@router.get("/structure.json", response_model=list[Structure])
def list_structures(source: DataSource = Depends(get_source)):
    return require(source.get_structure()).to_dicts()


@router.get("/structure/sources.json", response_model=list[DataSourceRecord])
def list_sources(source: DataSource = Depends(get_source)):
    return require(source.get_data_sources()).to_dicts()


@router.get("/structure/topology.json", response_model=list[GeneTopology])
def list_topology(source: DataSource = Depends(get_source)):
    return require(source.get_topology()).to_dicts()


# :path so mirrored experimental coordinates resolve under models/pdb/
@router.get("/structure/models/{filename:path}")
def get_model(filename: str, source: DataSource = Depends(get_source)):
    path = source.model_path(filename)
    if path is None:
        raise HTTPException(404, f"No model file {filename!r}")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/structure/{gene_id}.json", response_model=StructureDetail)
def get_structure(gene_id: str, source: DataSource = Depends(get_source)):
    df = require(source.get_structure(gene_id))
    if df.is_empty():
        raise HTTPException(404, f"No structure record for {gene_id!r}")
    return df.to_dicts()[0]


@router.get("/structure/{gene_id}/features.json", response_model=list[ProteinFeature])
def get_features(gene_id: str, source: DataSource = Depends(get_source)):
    return require(source.get_protein_features(gene_id)).to_dicts()


@router.get("/structure/{gene_id}/experimental.json", response_model=list[ExperimentalStructure])
def get_experimental(gene_id: str, source: DataSource = Depends(get_source)):
    return require(source.get_experimental_structures(gene_id)).to_dicts()
