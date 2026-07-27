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
  n_binding_sites: number
  n_experimental: number
  best_pdb_id: string | null
  best_method: string | null
  best_resolution: number | null
}

export type SeqAgreement = "exact" | "isoform" | "differs" | "unknown"

export const SEQ_AGREEMENT_LABEL: Record<SeqAgreement, string> = {
  exact: "Matches Ensembl canonical",
  isoform: "Matches an Ensembl isoform",
  differs: "Differs from Ensembl canonical",
  unknown: "No Ensembl protein to compare",
}

export type FeatureType = "transmembrane" | "topological_domain" | "binding_site" | "active_site"

export interface ProteinFeature {
  gene_id: string
  uniprot_accession: string | null
  feature_type: FeatureType
  start: number
  end: number
  description: string | null
  ligand_name: string | null
  ligand_chebi: string | null
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

/** The four AlphaFold pLDDT bands, ordered most to least confident */
export const PLDDT_BANDS = [
  { key: "frac_plddt_very_high", label: "Very high (>90)", color: "#0053d6" },
  { key: "frac_plddt_confident", label: "Confident (70-90)", color: "#65cbf3" },
  { key: "frac_plddt_low", label: "Low (50-70)", color: "#ffdb13" },
  { key: "frac_plddt_very_low", label: "Very low (<50)", color: "#ff7d45" },
] as const satisfies readonly { key: keyof StructureRecord; label: string; color: string }[]
