// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  GENE_LABEL_GAP,
  GENE_LABEL_MIN_W,
  GENE_LABEL_PAD,
  GENE_LABEL_W,
  MONO_CHAR_W,
} from "./constants"

export function geneLabelWidth(maxLabelLength: number, fontSize: number): number {
  if (maxLabelLength <= 0) return GENE_LABEL_W
  return Math.max(
    GENE_LABEL_MIN_W,
    Math.ceil(maxLabelLength * fontSize * MONO_CHAR_W) + GENE_LABEL_GAP + GENE_LABEL_PAD,
  )
}

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
