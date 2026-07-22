// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from "react"
import type { MouseEvent, RefObject } from "react"
import type { CellPos } from "./types"

export function useCellHitTest(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cellW: number,
  cellH: number,
  nRows: number,
  nCols: number,
) {
  return useCallback(
    (e: MouseEvent): CellPos | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const cr = canvas.getBoundingClientRect()
      const col = Math.floor((e.clientX - cr.left) / cellW)
      const row = Math.floor((e.clientY - cr.top) / cellH)
      if (row < 0 || row >= nRows || col < 0 || col >= nCols) return null
      return { row, col }
    },
    [canvasRef, cellW, cellH, nRows, nCols],
  )
}
