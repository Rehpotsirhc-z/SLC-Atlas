// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import { cellRect } from "./geometry"

const OUTLINE_Y_OFFSET = 0.5

interface CellOutlineProps {
  row: number
  col: number
  cellW: number
  cellH: number
  zIndex?: number
}

export default function CellOutline({ row, col, cellW, cellH, zIndex }: CellOutlineProps) {
  const { x, y, w, h } = cellRect(row, col, cellW, cellH, OUTLINE_Y_OFFSET)
  return (
    <Box
      sx={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        pointerEvents: "none",
        zIndex,
        boxShadow: (t) => `inset 0 0 0 2px ${t.palette.secondary.main}`,
      }}
    />
  )
}
