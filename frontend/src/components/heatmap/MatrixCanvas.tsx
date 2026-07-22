// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { MouseEvent, ReactNode, RefObject } from "react"
import { Box } from "@mui/material"
import CellOutline from "./CellOutline"
import type { CellPos } from "./types"

interface MatrixCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  gridW: number
  gridH: number
  cellW: number
  cellH: number
  hitTest: (e: MouseEvent) => CellPos | null
  hoverCell: CellPos | null
  selectedCell: CellPos | null
  selectedZIndex?: number
  onHover: (e: MouseEvent | null) => void
  onCellClick: (hit: CellPos) => void
  children?: ReactNode
}

export default function MatrixCanvas({
  canvasRef,
  gridW,
  gridH,
  cellW,
  cellH,
  hitTest,
  hoverCell,
  selectedCell,
  selectedZIndex,
  onHover,
  onCellClick,
  children,
}: MatrixCanvasProps) {
  return (
    <Box sx={{ position: "relative", zIndex: 0, width: gridW, height: gridH, flexShrink: 0 }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: gridW, height: gridH, cursor: "pointer" }}
        onPointerMove={(e) => {
          if (e.pointerType === "touch") return
          onHover(e)
        }}
        onPointerLeave={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          const hit = hitTest(e)
          if (!hit) return
          onCellClick(hit)
        }}
      />
      {children}
      {selectedCell && (
        <CellOutline
          row={selectedCell.row}
          col={selectedCell.col}
          cellW={cellW}
          cellH={cellH}
          zIndex={selectedZIndex}
        />
      )}
      {hoverCell && (
        <CellOutline row={hoverCell.row} col={hoverCell.col} cellW={cellW} cellH={cellH} />
      )}
    </Box>
  )
}
