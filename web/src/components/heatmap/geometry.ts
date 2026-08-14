// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface CellRect {
  x: number
  y: number
  w: number
  h: number
}

// 1px short in each axis so neighboring cells stay separated by the backdrop
export function cellRect(
  row: number,
  col: number,
  cellW: number,
  cellH: number,
  yOffset = 0,
): CellRect {
  return { x: col * cellW, y: row * cellH + yOffset, w: cellW - 1, h: cellH - 1 }
}
