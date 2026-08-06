// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from "react"
import { useTheme } from "@mui/material"
import HeatmapColorLegend, { type LegendTick } from "@/components/HeatmapColorLegend"
import { lerpHex } from "@/utils/tpmColor"
import { CELL_METRICS, type CellMetricKey } from "@/types/conservation"

interface Props {
  metric: CellMetricKey
}

export default function ConservationLegend({ metric }: Props) {
  const theme = useTheme()
  const metricDef = CELL_METRICS.find((m) => m.key === metric)!

  const colorAt = useCallback(
    (t: number) => lerpHex(theme.palette.background.paper, theme.palette.primary.main, t),
    [theme.palette.background.paper, theme.palette.primary.main],
  )

  const ticks: LegendTick[] = useMemo(() => {
    const [lo, hi] = metricDef.domain
    return [
      { frac: 0, label: String(lo) },
      { frac: 0.5, label: String((lo + hi) / 2) },
      { frac: 1, label: String(hi) },
    ]
  }, [metricDef])

  return (
    <HeatmapColorLegend
      title={metricDef.label}
      colorAt={colorAt}
      ticks={ticks}
      absent={{ color: theme.palette.background.paper, label: "no ortholog" }}
    />
  )
}
