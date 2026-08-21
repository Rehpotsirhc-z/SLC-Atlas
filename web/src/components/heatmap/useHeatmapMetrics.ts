// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { AUTO_CELL_SIZE, type CellSize } from "@/types/heatmap"
import {
  CELL_H_MAX,
  CELL_H_MIN,
  CELL_W_MAX,
  CELL_W_MIN,
  GENE_LABEL_W,
  GENE_TOGGLE_W,
  GENE_TREE_W,
  LEFT_GUTTER,
  LEGEND_W,
  MAX_CELL_W,
  MIN_CELL_W,
  RIGHT_PAD,
  ROW_H_MAX,
  ROW_H_MIN,
} from "./constants"
import { geneLabelWidth } from "./geometry"

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

interface HeatmapMetrics {
  leftColW: number
  geneLabelW: number
  legendReserve: number
  showLegend: boolean
  cellW: number
  cellH: number
  geneFont: number
  geneDotR: number
  colFont: number
}

const leftColWidth = (showGeneTree: boolean, labelW: number) =>
  (showGeneTree ? GENE_TREE_W : 0) + labelW + LEFT_GUTTER + GENE_TOGGLE_W

export function useHeatmapMetrics(
  containerW: number,
  nCols: number,
  hasLegend: boolean,
  showGeneTree: boolean,
  cellSize: CellSize = AUTO_CELL_SIZE,
  maxLabelLength = 0,
): HeatmapMetrics {
  const defaultLeftColW = leftColWidth(showGeneTree, GENE_LABEL_W)
  const legendReserve =
    hasLegend && containerW - defaultLeftColW - LEGEND_W - RIGHT_PAD >= nCols * MIN_CELL_W
      ? LEGEND_W
      : 0

  const { width: customWidth, height: customHeight } = cellSize
  const cellW = useMemo(() => {
    if (customWidth != null) return clamp(customWidth, CELL_W_MIN, CELL_W_MAX)
    if (!nCols || !containerW) return MIN_CELL_W
    const availableWidth = containerW - defaultLeftColW - legendReserve
    return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.floor(availableWidth / nCols)))
  }, [containerW, nCols, defaultLeftColW, legendReserve, customWidth])

  const cellH =
    customHeight != null
      ? clamp(customHeight, CELL_H_MIN, CELL_H_MAX)
      : Math.max(ROW_H_MIN, Math.min(ROW_H_MAX, Math.round(cellW * 0.8)))
  const geneFont = Math.max(10, Math.min(13, Math.round(cellH * 0.5)))

  const geneLabelW = geneLabelWidth(maxLabelLength, geneFont)

  return {
    leftColW: leftColWidth(showGeneTree, geneLabelW),
    geneLabelW,
    legendReserve,
    showLegend: legendReserve > 0,
    cellW,
    cellH,
    geneFont,
    geneDotR: geneFont * (4.5 / 13),
    colFont: Math.max(11, Math.min(13, Math.round(cellW * 0.3))),
  }
}
