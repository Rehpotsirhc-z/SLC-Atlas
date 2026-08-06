// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ClusterNode } from "./clustering"
import type { CellMetricKey, ConservationCell } from "./conservation"
import type { ExpressionRow } from "./expression"
import type { Gene } from "./gene"

export interface GeneInfo {
  node: ClusterNode
  methodLabel: string
  closestSymbol: string | null
  gene: Gene | null
}

export interface ConservationGeneInfo {
  geneId: string
  symbol: string
  family: string | null
  gene: Gene | null
  cells: ConservationCell[]
}

export interface ExpressionGeneInfo {
  geneId: string
  symbol: string
  family: string | null
  gene: Gene | null
  rows: ExpressionRow[]
}

export type PopupContent =
  | { kind: "clustering"; info: GeneInfo }
  | { kind: "conservation"; info: ConservationGeneInfo; metric: CellMetricKey }
  | { kind: "expression"; info: ExpressionGeneInfo }
