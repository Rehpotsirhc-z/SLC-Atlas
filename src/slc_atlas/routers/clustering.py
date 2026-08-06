# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from ..data.source import DataSource
from ..deps import get_source
from ..models.clustering import ClusterMethod, ClusterNode
from ..responses import newick_response

router = APIRouter()


@router.get("/clustering/{method}.json", response_model=list[ClusterNode])
def get_clustering(
    method: ClusterMethod,
    source: DataSource = Depends(get_source),
):
    return source.get_clustering(method=method).to_dicts()


@router.get("/clustering/{method}.nwk", response_class=PlainTextResponse)
def get_clustering_newick(
    method: ClusterMethod,
    source: DataSource = Depends(get_source),
):
    return newick_response(source.get_clustering_newick(method=method), method)
