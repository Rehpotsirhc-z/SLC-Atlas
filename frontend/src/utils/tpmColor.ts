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

// Linear interpolation between two hex colors, clamped to [0,1]
export function lerpHex(from: string, to: string, t: number): string {
  const u = Math.max(0, Math.min(1, t))
  const [ar, ag, ab] = hexToRgb(from)
  const [br, bg, bb] = hexToRgb(to)
  return `rgb(${Math.round(ar + (br - ar) * u)},${Math.round(ag + (bg - ag) * u)},${Math.round(ab + (bb - ab) * u)})`
}

export function tpmIntensity(tpm: number | null, domainMax: number): number {
  if (tpm === null) return 0
  return Math.max(0, Math.min(1, Math.log2(tpm + 1) / domainMax))
}

// Cap the scale at this percentile of the loaded values to prevent a few highly expressed genes from ruining the whole heatmap
const SCALE_PERCENTILE = 0.99

export function useTpmColorScale(rows: ExpressionRow[]) {
  const theme = useTheme()

  const domainMax = useMemo(() => {
    if (rows.length === 0) return 1
    const vals = rows.map((r) => Math.log2(r.tpm + 1)).sort((a, b) => a - b)
    const idx = Math.floor(SCALE_PERCENTILE * (vals.length - 1))
    return vals[idx] || 1
  }, [rows])

  const absentColor = theme.palette.action.disabledBackground
  const paper = theme.palette.background.paper
  const primary = theme.palette.primary.main

  // Precompute a 256-entry paper→primary gradient once per theme. The heatmap
  // redraw calls colorFor tens of thousands of times (once per cell) on every
  // theme toggle; using a lookup table turns each call into a single array
  // index instead.
  const lut = useMemo(() => {
    const [br, bg, bb] = hexToRgb(paper)
    const [pr, pg, pb] = hexToRgb(primary)
    const N = 256
    const arr = new Array<string>(N)
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1)
      const r = Math.round(br + (pr - br) * t)
      const g = Math.round(bg + (pg - bg) * t)
      const b = Math.round(bb + (pb - bb) * t)
      arr[i] = `rgb(${r},${g},${b})`
    }
    return arr
  }, [paper, primary])

  const colorFor = useCallback(
    (tpm: number | null): string => {
      if (tpm === null) return absentColor
      const t = tpmIntensity(tpm, domainMax)
      return lut[Math.round(t * (lut.length - 1))]
    },
    [domainMax, absentColor, lut],
  )

  return { colorFor, domainMax }
}
