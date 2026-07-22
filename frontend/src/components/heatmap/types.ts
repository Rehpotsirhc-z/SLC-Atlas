// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface CellPos {
  row: number
  col: number
}

export interface CellHover extends CellPos {
  clientX: number
  clientY: number
}
