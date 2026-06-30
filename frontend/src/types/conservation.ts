// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface ConservationCell {
  gene_id: string
  symbol: string | null
  family: string | null
  species: string
  species_label: string | null
  perc_id: number | null
  perc_id_r1: number | null
  perc_pos: number | null
  dn_ds: number | null
  orthology_type: string | null
  ortholog_count: number
  target_gene_id: string | null
}

export interface SpeciesNode {
  node_id: number
  parent_id: number | null
  branch_length: number
  species: string | null
  species_label: string | null
  taxon_id: number | null
}
