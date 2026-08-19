# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from ..data.source import DataSource
from ..deps import get_source
from ..models.conservation import ConservationCell, SpeciesNode
from ..responses import newick_response
from .availability import unavailable_guard

router = APIRouter()

require = unavailable_guard("Conservation data is not built for this dataset")


@router.get(
    "/conservation.json",
    response_model=list[ConservationCell],
    summary="Ortholog identity for every gene and species",
)
def get_conservation(source: DataSource = Depends(get_source)):
    return require(source.get_conservation()).to_dicts()


@router.get(
    "/conservation/species-tree.json",
    response_model=list[SpeciesNode],
    summary="The species tree, as a flat table of nodes",
)
def get_species_tree(source: DataSource = Depends(get_source)):
    return require(source.get_species_tree()).to_dicts()


@router.get(
    "/conservation/species-tree.nwk",
    response_class=PlainTextResponse,
    summary="The species tree, as Newick",
)
def get_species_tree_newick(source: DataSource = Depends(get_source)):
    return newick_response(require(source.get_species_tree_newick()), "species_tree")
