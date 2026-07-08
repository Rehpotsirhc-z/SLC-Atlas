// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from "react"
import { useTheme } from "@mui/material"
import type { ExpressionRow } from "@/types/expression"

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

export function tpmIntensity(tpm: number | null, domainMax: number): number {
  if (tpm === null) return 0
  return Math.max(0, Math.min(1, Math.log2(tpm + 1) / domainMax))
}

export function useTpmColorScale(rows: ExpressionRow[]) {
  const theme = useTheme()

  const domainMax = useMemo(() => {
    let max = 0
    for (const r of rows) max = Math.max(max, Math.log2(r.tpm + 1))
    return max || 1
  }, [rows])

  const absentColor = theme.palette.action.disabledBackground

  const colorFor = useCallback(
    (tpm: number | null): string => {
      if (tpm === null) return absentColor
      const t = tpmIntensity(tpm, domainMax)
      const [br, bg, bb] = hexToRgb(theme.palette.background.paper)
      const [pr, pg, pb] = hexToRgb(theme.palette.primary.main)
      const r = Math.round(br + (pr - br) * t)
      const g = Math.round(bg + (pg - bg) * t)
      const b = Math.round(bb + (pb - bb) * t)
      return `rgb(${r},${g},${b})`
    },
    [domainMax, absentColor, theme.palette.background.paper, theme.palette.primary.main],
  )

  return { colorFor, domainMax }
}
