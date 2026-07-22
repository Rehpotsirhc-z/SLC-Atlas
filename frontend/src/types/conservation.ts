// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export const CELL_METRICS = [
  { key: "perc_id", label: "% identity", field: "perc_id", domain: [0, 100] },
  { key: "perc_pos", label: "% positives", field: "perc_pos", domain: [0, 100] },
] as const

export type CellMetricKey = (typeof CELL_METRICS)[number]["key"]

export interface ConservationCell {
  gene_id: string
  symbol: string | null
  family: string | null
  species: string
  species_label: string | null
  perc_id: number | null
  perc_id_r1: number | null
  perc_pos: number | null
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
