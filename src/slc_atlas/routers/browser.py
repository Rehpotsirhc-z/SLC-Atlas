# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, HTTPException, Request

from ..data.source import DataSource
from ..deps import get_source
from ..models.browser import Region, TrackManifest
from ..models.structure import DataSourceRecord
from ..responses import byte_range_file

router = APIRouter()

UNAVAILABLE = "Genome Browser data is not available for this dataset"

# Everything drawn along the axis is read by byte range and served as a file rather than as a
# response built per gene: the view asks for a place, not for a gene


def require(value):
    if value is None:
        raise HTTPException(404, UNAVAILABLE)
    return value


@router.get(
    "/browser/tracks.json",
    response_model=TrackManifest,
    summary="The coverage tracks, GWAS studies, and chromosomes this atlas can draw",
)
def get_manifest(source: DataSource = Depends(get_source)):
    return require(source.get_track_manifest())


@router.get(
    "/browser/sources.json",
    response_model=list[DataSourceRecord],
    summary="Where the browser data came from, and under what licence",
)
def list_sources(source: DataSource = Depends(get_source)):
    return require(source.get_browser_sources()).to_dicts()


# Keep this route before gene routes so filenames are not interpreted as gene IDs
@router.get("/browser/coverage/{filename:path}", summary="One coverage track")
def get_coverage(filename: str, request: Request, source: DataSource = Depends(get_source)):
    path = source.coverage_path(filename)
    if path is None:
        raise HTTPException(404, f"Coverage track {filename!r} was not found")
    return byte_range_file(path, request)


@router.get("/browser/models.bb", summary="Every transcript model, read by byte range")
def get_models(request: Request, source: DataSource = Depends(get_source)):
    path = source.models_path()
    if path is None:
        raise HTTPException(404, UNAVAILABLE)
    return byte_range_file(path, request)


@router.get(
    "/browser/gwas/{study_id}.bb", summary="One study's variants, read by byte range"
)
def get_gwas(study_id: str, request: Request, source: DataSource = Depends(get_source)):
    path = source.gwas_path(study_id)
    if path is None:
        raise HTTPException(404, f"GWAS study {study_id!r} was not found")
    return byte_range_file(path, request)


@router.get(
    "/browser/{gene_id}/region.json",
    response_model=Region,
    summary="Where one gene sits, and how far the view may travel from it",
)
def get_region(gene_id: str, source: DataSource = Depends(get_source)):
    windows = source.get_region(gene_id)
    if windows is None and source.capabilities().get("browser"):
        raise HTTPException(404, f"No Genome Browser region was found for {gene_id!r}")
    return require(windows)
