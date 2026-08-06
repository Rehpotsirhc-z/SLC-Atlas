# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from ..data.source import DataSource
from ..deps import get_source
from ..models.conservation import ConservationCell, SpeciesNode
from ..responses import newick_response

router = APIRouter()


@router.get("/conservation.json", response_model=list[ConservationCell])
def get_conservation(source: DataSource = Depends(get_source)):
    return source.get_conservation().to_dicts()


@router.get("/conservation/species-tree.json", response_model=list[SpeciesNode])
def get_species_tree(source: DataSource = Depends(get_source)):
    return source.get_species_tree().to_dicts()


@router.get("/conservation/species-tree.nwk", response_class=PlainTextResponse)
def get_species_tree_newick(source: DataSource = Depends(get_source)):
    return newick_response(source.get_species_tree_newick(), "species_tree")
