// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface ClusterNode {
  method: string
  node_id: number
  parent_id: number | null
  branch_length: number
  gene_id: string | null
  symbol: string | null
  family: string | null
}
