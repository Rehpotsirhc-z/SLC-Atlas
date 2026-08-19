# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, HTTPException, Request
from ..data.source import DataSource
from ..deps import get_source
from ..responses import byte_range_file
from ..models.structure import (
    ExperimentalStructure,
    GeneTopology,
    ProteinFeature,
    Structure,
    StructureDetail,
)
from .availability import unavailable_guard

router = APIRouter()

UNAVAILABLE = "Structure data is not built for this dataset"

require = unavailable_guard(UNAVAILABLE)


@router.get(
    "/structure.json",
    response_model=list[Structure],
    summary="One row per gene, describing its predicted model",
)
def list_structures(source: DataSource = Depends(get_source)):
    return require(source.get_structure()).to_dicts()


@router.get(
    "/structure/topology.json",
    response_model=list[GeneTopology],
    summary="Membrane topology for every gene at once",
)
def list_topology(source: DataSource = Depends(get_source)):
    return require(source.get_topology()).to_dicts()


# :path so mirrored experimental coordinates resolve under models/pdb/
@router.get("/structure/models/{filename:path}", summary="One mirrored coordinate file")
def get_model(filename: str, request: Request, source: DataSource = Depends(get_source)):
    path = source.model_path(filename)
    if path is None:
        raise HTTPException(404, f"No model file {filename!r}")
    return byte_range_file(path, request)


@router.get(
    "/structure/{gene_id}.json",
    response_model=StructureDetail,
    summary="One gene's structure record, with its per-residue confidence",
)
def get_structure(gene_id: str, source: DataSource = Depends(get_source)):
    df = require(source.get_structure(gene_id))
    if df.is_empty():
        raise HTTPException(404, f"No structure record for {gene_id!r}")
    return df.to_dicts()[0]


@router.get(
    "/structure/{gene_id}/features.json",
    response_model=list[ProteinFeature],
    summary="One gene's topology and binding features",
)
def get_features(gene_id: str, source: DataSource = Depends(get_source)):
    return require(source.get_protein_features(gene_id)).to_dicts()


@router.get(
    "/structure/{gene_id}/experimental.json",
    response_model=list[ExperimentalStructure],
    summary="The experimental structures covering one gene",
)
def get_experimental(gene_id: str, source: DataSource = Depends(get_source)):
    return require(source.get_experimental_structures(gene_id)).to_dicts()
