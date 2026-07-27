// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface StructureRecord {
  gene_id: string
  symbol: string | null
  uniprot_accession: string | null
  uniprot_id: string | null
  uniprot_length: number | null
  seq_agreement: SeqAgreement | null
  id_route: string | null
  afdb_entry_id: string | null
  afdb_version: number | null
  model_file: string | null
  model_format: string | null
  model_available: boolean
  model_source_url: string | null
  model_page_url: string | null
  mean_plddt: number | null
  frac_plddt_very_high: number | null
  frac_plddt_confident: number | null
  frac_plddt_low: number | null
  frac_plddt_very_low: number | null
  model_created: string | null
  alphafill_page_url: string | null
  n_transmembrane: number
  n_intramembrane: number
  n_binding_sites: number
  n_binding_residues: number
  n_experimental: number
  best_pdb_id: string | null
  best_method: string | null
  best_resolution: number | null
}

export interface StructureDetail extends StructureRecord {
  // Per-residue confidence, index 0 = residue 1, carried only by the per-gene endpoint
  plddt: number[] | null
}

export type SeqAgreement = "exact" | "isoform" | "differs" | "unknown"

export type FeatureType =
  | "transmembrane"
  | "intramembrane"
  | "topological_domain"
  | "binding_site"
  | "active_site"
  // Not drawn: each one pins its residue to the non-cytoplasmic face, which is how the
  // figure works out which way round the membrane sits
  | "glycosylation"
  | "disulfide_bond"
  | "signal_peptide"

export interface ProteinFeature {
  gene_id: string
  uniprot_accession: string | null
  feature_type: FeatureType
  start: number
  end: number
  description: string | null
  ligand_name: string | null
  ligand_chebi: string | null
  // Distinguishes separate sites of the same ligand, e.g. Na(+) site 1 vs site 2
  ligand_label: number | null
}

export interface ExperimentalStructure {
  gene_id: string
  uniprot_accession: string | null
  pdb_id: string
  method: string | null
  resolution: number | null
  coverage: number | null
  uniprot_start: number | null
  uniprot_end: number | null
  chains: string | null
  ligand_ccd: string | null
  model_url: string | null
  model_page_url: string | null
  created: string | null
}

export interface DataSourceRecord {
  source: string
  version: string | null
  retrieved_date: string | null
  license_spdx: string | null
  url: string | null
}

// AlphaFold's pLDDT bands, most to least confident, in its own wording
export const PLDDT_BANDS = [
  { min: 90, label: "very high confidence" },
  { min: 70, label: "confident" },
  { min: 50, label: "low confidence" },
  { min: 0, label: "very low, treat as unreliable" },
] as const

export function plddtBand(score: number): string {
  return (PLDDT_BANDS.find((band) => score >= band.min) ?? PLDDT_BANDS[3]).label
}
