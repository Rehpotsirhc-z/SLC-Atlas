// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface ExpressionRow {
  gene_id: string
  symbol: string | null
  family: string | null
  tissue: string
  tpm: number
}
