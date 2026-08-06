// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import {
  LEFT_COL_W,
  LEGEND_W,
  MAX_CELL_W,
  MIN_CELL_W,
  RIGHT_PAD,
  ROW_H_MAX,
  ROW_H_MIN,
} from "./constants"

interface HeatmapMetrics {
  legendReserve: number
  showLegend: boolean
  cellW: number
  cellH: number
  geneFont: number
  geneDotR: number
  colFont: number
}

export function useHeatmapMetrics(
  containerW: number,
  nCols: number,
  hasLegend: boolean,
): HeatmapMetrics {
  const legendReserve =
    hasLegend && containerW - LEFT_COL_W - LEGEND_W - RIGHT_PAD >= nCols * MIN_CELL_W ? LEGEND_W : 0

  const cellW = useMemo(() => {
    if (!nCols || !containerW) return MIN_CELL_W
    const avail = containerW - LEFT_COL_W - legendReserve
    return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.floor(avail / nCols)))
  }, [containerW, nCols, legendReserve])

  const cellH = Math.max(ROW_H_MIN, Math.min(ROW_H_MAX, Math.round(cellW * 0.8)))
  const geneFont = Math.max(10, Math.min(13, Math.round(cellH * 0.5)))

  return {
    legendReserve,
    showLegend: legendReserve > 0,
    cellW,
    cellH,
    geneFont,
    geneDotR: geneFont * (4.5 / 13),
    colFont: Math.max(11, Math.min(13, Math.round(cellW * 0.3))),
  }
}
