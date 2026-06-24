# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from ..deps import get_source
from ..data.parquet_source import ParquetSource
from ..models.conservation import ConservationCell, SpeciesNode

router = APIRouter()


@router.get("/conservation", response_model=list[ConservationCell])
def get_conservation(
    gene_ids: list[str] | None = Query(None),
    source: ParquetSource = Depends(get_source),
):
    return source.get_conservation(gene_ids=gene_ids).to_dicts()


@router.get("/conservation/species-tree", response_model=list[SpeciesNode])
def get_species_tree(source: ParquetSource = Depends(get_source)):
    return source.get_species_tree().to_dicts()


@router.get("/conservation/species-tree/newick", response_class=PlainTextResponse)
def get_species_tree_newick(source: ParquetSource = Depends(get_source)):
    newick = source.get_species_tree_newick()
    return PlainTextResponse(
        newick,
        media_type="text/x-nh",
        headers={"Content-Disposition": 'attachment; filename="slc_species_tree.nwk"'},
    )
