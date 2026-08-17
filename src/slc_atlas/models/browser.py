# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from typing import Literal

from pydantic import BaseModel

ChromRole = Literal["primary", "alt", "unplaced"]


class Chrom(BaseModel):
    chrom: str
    ensembl: str
    size: int
    role: ChromRole


class CoverageTrack(BaseModel):
    track_id: str
    label: str
    group: str
    stranded: bool
    local: bool
    file: str | None = None
    plus_file: str | None = None
    minus_file: str | None = None
    url: str | None = None
    plus_url: str | None = None
    minus_url: str | None = None
    bin: int = 0
    bytes: int = 0
    # Minimum bases per column for trusted summaries, or 0 when summaries are unavailable
    reduction: int = 0
    chroms: list[str] = []


class GwasStudy(BaseModel):
    study_id: str
    trait: str
    citation: str | None = None
    source: str | None = None
    assembly: str | None = None
    license_spdx: str | None = None
    n_variants: int = 0
    # Chromosomes represented by the study, used to distinguish unavailable data from no hits
    chroms: list[str] = []
    # GWAS pyramid bin sizes in bases per column, finest first
    levels: list[int] = []


class TrackManifest(BaseModel):
    chroms: list[Chrom]
    tracks: list[CoverageTrack]
    studies: list[GwasStudy]


class Region(BaseModel):
    gene_id: str
    symbol: str | None = None
    chrom: str
    chrom_ensembl: str
    chrom_size: int | None = None
    gene_start: int
    gene_end: int
    strand: str | None = None
    window_start: int
    window_end: int
    # How far the view may travel from this gene, which is as much genome as the build kept
    pan_start: int
    pan_end: int
    flank: int
    clipped: bool = False
