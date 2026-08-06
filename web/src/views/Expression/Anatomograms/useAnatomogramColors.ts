// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from "react"
import { useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { hexToRgb, tpmIntensity } from "@/utils/tpmColor"

const REST_ALPHA = { dark: 0.16, light: 0.13 }
const SILHOUETTE_OPACITY = { dark: 0.34, light: 0.28 }
const HOVER_ALPHA = 0.6

export function useAnatomogramColors(domainMax: number) {
  const theme = useTheme()

  const colors = useMemo(() => {
    const base = theme.palette.text.primary
    const restAlpha = REST_ALPHA[theme.palette.mode]
    return {
      base,
      silhouetteOpacity: SILHOUETTE_OPACITY[theme.palette.mode],
      idle: "transparent",
      rest: alpha(base, restAlpha),
      hover: alpha(theme.palette.primary.main, HOVER_ALPHA),
      restAlpha,
      hoverAlpha: HOVER_ALPHA,
      restRgb: hexToRgb(base),
      hoverRgb: hexToRgb(theme.palette.primary.main),
    }
  }, [theme])

  const intensityFill = useCallback(
    (tpm: number | null): string => {
      const t = tpmIntensity(tpm, domainMax)
      const [r0, g0, b0] = colors.restRgb
      const [r1, g1, b1] = colors.hoverRgb
      const r = Math.round(r0 + (r1 - r0) * t)
      const g = Math.round(g0 + (g1 - g0) * t)
      const b = Math.round(b0 + (b1 - b0) * t)
      const a = colors.restAlpha + (colors.hoverAlpha - colors.restAlpha) * t
      return `rgba(${r},${g},${b},${a.toFixed(3)})`
    },
    [domainMax, colors],
  )

  return { colors, intensityFill }
}

export type AnatomogramColors = ReturnType<typeof useAnatomogramColors>["colors"]
