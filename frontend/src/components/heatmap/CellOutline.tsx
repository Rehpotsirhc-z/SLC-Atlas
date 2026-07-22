// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"

interface CellOutlineProps {
  row: number
  col: number
  cellW: number
  cellH: number
  zIndex?: number
}

export default function CellOutline({ row, col, cellW, cellH, zIndex }: CellOutlineProps) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: col * cellW,
        top: row * cellH + 0.5,
        width: cellW - 1,
        height: cellH - 1,
        pointerEvents: "none",
        zIndex,
        boxShadow: (t) => `inset 0 0 0 2px ${t.palette.secondary.main}`,
      }}
    />
  )
}
