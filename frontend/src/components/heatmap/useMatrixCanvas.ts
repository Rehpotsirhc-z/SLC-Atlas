// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react"
import type { RefObject } from "react"

interface MatrixCanvasOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  nRows: number
  nCols: number
  gridW: number
  gridH: number
  cellW: number
  cellH: number
  background: string
  fillFor: (row: number, col: number) => string
  alphaFor: (row: number) => number
  cellYOffset?: number
  axisLines?: string | null
}

export function useMatrixCanvas({
  canvasRef,
  nRows,
  nCols,
  gridW,
  gridH,
  cellW,
  cellH,
  background,
  fillFor,
  alphaFor,
  cellYOffset = 0,
  axisLines = null,
}: MatrixCanvasOptions) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || gridW === 0 || gridH === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = gridW * dpr
    canvas.height = gridH * dpr
    const ctx = canvas.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, gridW, gridH)
    for (let r = 0; r < nRows; r++) {
      const a = alphaFor(r)
      for (let c = 0; c < nCols; c++) {
        ctx.globalAlpha = a
        ctx.fillStyle = fillFor(r, c)
        ctx.fillRect(c * cellW, r * cellH + cellYOffset, cellW - 1, cellH - 1)
      }
    }
    ctx.globalAlpha = 1
    if (axisLines) {
      ctx.fillStyle = axisLines
      ctx.fillRect(0, 0, 1, gridH)
      ctx.fillRect(0, 0, gridW, 1)
    }
  }, [
    canvasRef,
    nRows,
    nCols,
    gridW,
    gridH,
    cellW,
    cellH,
    background,
    fillFor,
    alphaFor,
    cellYOffset,
    axisLines,
  ])
}
