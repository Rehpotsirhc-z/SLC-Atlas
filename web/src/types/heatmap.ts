// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface CellSize {
  width: number | null
  height: number | null
}

export const AUTO_CELL_SIZE: CellSize = { width: null, height: null }
