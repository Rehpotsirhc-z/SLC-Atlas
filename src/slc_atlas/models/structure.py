# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

from typing import Literal

from pydantic import BaseModel

FeatureType = Literal[
    "transmembrane",
    "intramembrane",
    "topological_domain",
    "binding_site",
    "active_site",
    "glycosylation",
    "disulfide_bond",
    "signal_peptide",
]


class Structure(BaseModel):
    gene_id: str
    symbol: str | None = None
    uniprot_accession: str | None = None
    uniprot_id: str | None = None
    uniprot_length: int | None = None
    # Agreement with the Ensembl canonical protein: exact, isoform, differs, or unknown
    seq_agreement: str | None = None
    id_route: str | None = None
    afdb_entry_id: str | None = None
    afdb_version: int | None = None
    model_file: str | None = None
    model_format: str | None = None
    model_available: bool = False
    model_source_url: str | None = None
    model_page_url: str | None = None
    mean_plddt: float | None = None
    frac_plddt_very_high: float | None = None
    frac_plddt_confident: float | None = None
    frac_plddt_low: float | None = None
    frac_plddt_very_low: float | None = None
    model_created: str | None = None
    alphafill_page_url: str | None = None
    n_transmembrane: int = 0
    n_intramembrane: int = 0
    n_binding_sites: int = 0
    n_binding_residues: int = 0
    n_experimental: int = 0
    best_pdb_id: str | None = None
    best_method: str | None = None
    best_resolution: float | None = None


class StructureDetail(Structure):
    """One gene, with the per-residue columns the topology figure draws: AlphaFold's
    confidence, and the canonical sequence the snake plot letters its beads with."""

    plddt: list[int] | None = None
    sequence: str | None = None


class MembraneSegment(BaseModel):
    start: int
    end: int
    kind: Literal["transmembrane", "intramembrane"]


class GeneTopology(BaseModel):
    gene_id: str
    uniprot_length: int | None = None
    segments: list[MembraneSegment] = []


class ProteinFeature(BaseModel):
    gene_id: str
    uniprot_accession: str | None = None
    feature_type: FeatureType
    start: int
    end: int
    description: str | None = None
    ligand_name: str | None = None
    ligand_chebi: str | None = None
    ligand_label: int | None = None


class ExperimentalStructure(BaseModel):
    gene_id: str
    uniprot_accession: str | None = None
    pdb_id: str
    method: str | None = None
    resolution: float | None = None
    coverage: float | None = None
    uniprot_start: int | None = None
    uniprot_end: int | None = None
    chains: str | None = None
    ligand_ccd: str | None = None
    model_url: str | None = None
    model_page_url: str | None = None
    created: str | None = None


class DataSourceRecord(BaseModel):
    source: str
    version: str | None = None
    retrieved_date: str | None = None
    license_spdx: str | None = None
    url: str | None = None
