// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from "react"
import { useTheme } from "@mui/material"
import { hexToRgb } from "@/utils/tpmColor"
import type { CELL_METRICS, ConservationCell } from "@/types/conservation"

type CellMetric = (typeof CELL_METRICS)[number]

export function useConservationCellFill(
  matrix: (ConservationCell | undefined)[][],
  metricDef: CellMetric,
) {
  const theme = useTheme()
  const absentColor = theme.palette.background.paper

  const colorFor = useCallback(
    (value: number | null): string => {
      if (value === null) return absentColor
      const [lo, hi] = metricDef.domain
      const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
      const [br, bg, bb] = hexToRgb(theme.palette.background.paper)
      const [pr, pg, pb] = hexToRgb(theme.palette.primary.main)
      const r = Math.round(br + (pr - br) * t)
      const g = Math.round(bg + (pg - bg) * t)
      const b = Math.round(bb + (pb - bb) * t)
      return `rgb(${r},${g},${b})`
    },
    [metricDef, absentColor, theme.palette.background.paper, theme.palette.primary.main],
  )

  return useCallback(
    (r: number, c: number) => {
      const cell = matrix[r][c]
      if (!cell || cell.orthology_type === null) return absentColor
      return colorFor(cell[metricDef.field] as number | null)
    },
    [matrix, metricDef, colorFor, absentColor],
  )
}
