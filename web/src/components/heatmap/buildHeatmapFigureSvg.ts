// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { PaletteMode } from "@mui/material"
import type { DendroLayout } from "@/utils/dendrogram"
import { GENE_TREE_W, RIGHT_PAD } from "./constants"
import {
  cellRectsSvg,
  columnLabelsSvg,
  figureSvgDocument,
  geneLabelsSvg,
  svgFontFamily,
  treePathSvg,
} from "./figureSvg"
import type { GeneRow } from "./useGeneRows"

export interface HeatmapFigureOptions {
  geneTree: DendroLayout
  geneRows: GeneRow[]
  labels: string[]
  gridW: number
  gridH: number
  cellW: number
  cellH: number
  topH: number
  geneLabelW: number
  showGeneTree: boolean
  contentTop: number
  colLabelY: number
  columnTree?: string
  fillFor: (row: number, col: number) => string
  geneDotR: number
  geneFont: number
  colFont: number
  monoFont: string
  muted: string
  background: string
  gridLine: string
  mode: PaletteMode
}

export function buildHeatmapFigureSvg(o: HeatmapFigureOptions): string {
  const margin = RIGHT_PAD
  const leftW = (o.showGeneTree ? GENE_TREE_W : 0) + o.geneLabelW
  const dotX = o.showGeneTree ? GENE_TREE_W : o.geneDotR
  const svgFont = svgFontFamily(o.monoFont)
  return figureSvgDocument({
    width: leftW + o.gridW + margin * 2,
    height: o.topH - o.contentTop + o.gridH + margin * 2,
    margin,
    contentTop: o.contentTop,
    background: o.background,
    body:
      (o.showGeneTree ? treePathSvg(o.geneTree.edges, 0, o.topH, o.muted) : "") +
      (o.columnTree ?? "") +
      `<rect x="${leftW}" y="${o.topH}" width="${o.gridW}" height="${o.gridH}" fill="${o.gridLine}"/>` +
      cellRectsSvg({
        nRows: o.geneRows.length,
        nCols: o.labels.length,
        leftW,
        y0: o.topH,
        cellW: o.cellW,
        cellH: o.cellH,
        fillFor: o.fillFor,
      }) +
      geneLabelsSvg({
        geneRows: o.geneRows,
        dotX,
        y0: o.topH,
        cellH: o.cellH,
        geneDotR: o.geneDotR,
        geneFont: o.geneFont,
        svgFont,
        mode: o.mode,
      }) +
      columnLabelsSvg({
        labels: o.labels,
        leftW,
        y: o.colLabelY,
        cellW: o.cellW,
        font: o.colFont,
        svgFont,
        fill: o.muted,
      }),
  })
}
