# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..data.source import DataSource
from ..deps import get_source
from ..models.browser import GwasPoint, Region, TrackManifest
from ..models.structure import DataSourceRecord

router = APIRouter()

UNAVAILABLE = "Genome Browser data is not available for this dataset"


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
@router.get("/browser/coverage/{filename:path}", summary="One sliced coverage track")
def get_coverage(filename: str, source: DataSource = Depends(get_source)):
    path = source.coverage_path(filename)
    if path is None:
        raise HTTPException(404, f"Coverage track {filename!r} was not found")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get(
    "/browser/{gene_id}/region.json",
    response_model=Region,
    summary="One gene's window and the transcript models drawn inside it",
)
def get_region(gene_id: str, source: DataSource = Depends(get_source)):
    windows = source.get_region(gene_id)
    if windows is None and source.capabilities().get("browser"):
        raise HTTPException(404, f"No Genome Browser region was found for {gene_id!r}")
    return require(windows)


@router.get(
    "/browser/{gene_id}/gwas/{study_id}.json",
    response_model=list[GwasPoint],
    summary="The variants of one study that fall in one gene's window",
)
def get_gwas(gene_id: str, study_id: str, source: DataSource = Depends(get_source)):
    return require(source.get_gwas(gene_id, study_id)).to_dicts()
