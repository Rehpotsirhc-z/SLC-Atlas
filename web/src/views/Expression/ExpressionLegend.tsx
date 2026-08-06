// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from "react"
import { useTheme } from "@mui/material"
import HeatmapColorLegend, { type LegendTick } from "@/components/HeatmapColorLegend"
import type { ExpressionRow } from "@/types/expression"
import { formatTpmCompact } from "@/utils/format"
import { lerpHex, useTpmColorScale } from "@/utils/tpmColor"

interface Props {
  rows: ExpressionRow[]
}

export default function ExpressionLegend({ rows }: Props) {
  const theme = useTheme()
  const { domainMax } = useTpmColorScale(rows)

  const colorAt = useCallback(
    (t: number) => lerpHex(theme.palette.background.paper, theme.palette.primary.main, t),
    [theme.palette.background.paper, theme.palette.primary.main],
  )

  const ticks: LegendTick[] = useMemo(
    () => [
      { frac: 0, label: "0" },
      { frac: 0.5, label: formatTpmCompact(Math.pow(2, domainMax / 2) - 1) },
      { frac: 1, label: `≥${formatTpmCompact(Math.pow(2, domainMax) - 1)}` },
    ],
    [domainMax],
  )

  return (
    <HeatmapColorLegend
      title="TPM"
      colorAt={colorAt}
      ticks={ticks}
      absent={{ color: theme.palette.action.disabledBackground, label: "no data" }}
    />
  )
}
