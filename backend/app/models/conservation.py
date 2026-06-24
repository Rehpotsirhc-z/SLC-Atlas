# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from pydantic import BaseModel


class ConservationCell(BaseModel):
    gene_id: str
    symbol: str | None = None
    family: str | None = None
    species: str
    species_label: str | None = None
    perc_id: float | None = None
    perc_id_r1: float | None = None
    perc_pos: float | None = None
    dn_ds: float | None = None
    orthology_type: str | None = None
    ortholog_count: int = 0
    target_gene_id: str | None = None


class SpeciesNode(BaseModel):
    node_id: int
    parent_id: int | None = None
    branch_length: float
    species: str | None = None
    species_label: str | None = None
    taxon_id: int | None = None
