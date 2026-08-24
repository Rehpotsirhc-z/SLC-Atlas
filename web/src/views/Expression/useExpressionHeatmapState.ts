// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { useTheme } from "@mui/material"
import {
  COL_LABEL_GAP,
  CORNER_DROPDOWN_MIN_W,
  MONO_CHAR_W,
  SEARCH_PANEL_CLEAR_X,
} from "@/components/heatmap/constants"
import { useCellHitTest } from "@/components/heatmap/useCellHitTest"
import { useGeneRows } from "@/components/heatmap/useGeneRows"
import { useHeatmapGrid } from "@/components/heatmap/useHeatmapGrid"
import { useHeatmapMetrics } from "@/components/heatmap/useHeatmapMetrics"
import { useHeatmapResize } from "@/components/heatmap/useHeatmapResize"
import { useMatrixCanvas } from "@/components/heatmap/useMatrixCanvas"
import { useRowFocus } from "@/components/heatmap/useRowFocus"
import type { CellHover } from "@/components/heatmap/types"
import { useUIStore } from "@/store/uiStore"
import { useElementSize } from "@/utils/useElementSize"
import { displayTissue, sortedTissues } from "@/utils/tissue"
import { useTpmColorScale } from "@/utils/tpmColor"
import type { ClusterNode } from "@/types/clustering"
import type { ExpressionRow } from "@/types/expression"
import type { Gene } from "@/types/gene"
import { TISSUE_LABEL_H_MIN } from "./constants"
import { buildExpressionFigureSvg } from "./expressionFigureSvg"
import { useTissueFlash } from "./useTissueFlash"

export interface ExpressionHoverState extends CellHover {
  symbol: string
  name: string | null
  tissue: string
  value: number | null
}

interface Options {
  rows: ExpressionRow[]
  clusterNodes: ClusterNode[]
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
  showGeneTree: boolean
  hasLegend: boolean
}

const rowKey = (r: ExpressionRow) => `${r.gene_id}__${r.tissue}`
const tissueKey = (t: string) => t

export function useExpressionHeatmapState({
  rows,
  clusterNodes,
  familyFilter,
  selectedGeneId,
  onSelect,
  geneById,
  showGeneTree,
  hasLegend,
}: Options) {
  const theme = useTheme()
  const mode = theme.palette.mode
  const monoFont = theme.custom.monoFontFamily
  const muted = theme.palette.text.secondary
  const lineColor = theme.palette.divider
  const [containerRef, container] = useElementSize<HTMLDivElement>()
  const [headerRef, header] = useElementSize<HTMLDivElement>("offset")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<ExpressionHoverState | null>(null)
  const containerW = container.w

  const tissueCols = useMemo(() => sortedTissues(rows), [rows])

  const rawCellSize = useUIStore((s) => s.expressionCellSize)
  const setCellSize = useUIStore((s) => s.setExpressionCellSize)
  const cellSize = useDeferredValue(rawCellSize)
  const maxGeneLabelLength = useMemo(
    () =>
      clusterNodes.reduce(
        (maxLength, node) =>
          node.gene_id ? Math.max(maxLength, (node.symbol ?? node.gene_id).length) : maxLength,
        0,
      ),
    [clusterNodes],
  )

  const {
    leftColW,
    geneLabelW,
    cellW,
    cellH,
    geneFont,
    geneDotR,
    colFont: tissueFont,
    legendReserve,
    showLegend,
  } = useHeatmapMetrics(
    containerW,
    tissueCols.length,
    hasLegend,
    showGeneTree,
    cellSize,
    maxGeneLabelLength,
  )

  const topH = useMemo(() => {
    if (!tissueCols.length) return TISSUE_LABEL_H_MIN
    const maxLabelLength = Math.max(...tissueCols.map((t) => displayTissue(t).length))
    return Math.max(
      TISSUE_LABEL_H_MIN,
      Math.ceil(maxLabelLength * tissueFont * MONO_CHAR_W) + COL_LABEL_GAP + 4,
    )
  }, [tissueCols, tissueFont])

  const { geneTree, geneRows, rowByGene } = useGeneRows(clusterNodes, cellH)

  const grid = useHeatmapGrid({
    cells: rows,
    cellKey: rowKey,
    cols: tissueCols,
    colKey: tissueKey,
    geneRows,
    rowByGene,
    cellW,
    cellH,
    containerW,
    leftColW,
    legendReserve,
    familyFilter,
    selectedGeneId,
    onSelect,
  })
  const { matrix, gridW, gridH } = grid

  const { colorFor } = useTpmColorScale(rows)

  const cellFill = useCallback(
    (r: number, c: number) => {
      const cell = matrix[r][c]
      return colorFor(cell ? cell.tpm : null)
    },
    [matrix, colorFor],
  )

  useMatrixCanvas({
    canvasRef,
    nRows: matrix.length,
    nCols: tissueCols.length,
    gridW,
    gridH,
    cellW,
    cellH,
    background: lineColor,
    fillFor: cellFill,
    alphaFor: grid.rowAlpha,
    axisLines: lineColor,
  })

  const hitTest = useCellHitTest(canvasRef, cellW, cellH, geneRows.length, tissueCols.length)

  const onHover = useCallback(
    (e: MouseEvent | null) => {
      const hit = e && hitTest(e)
      if (!e || !hit) {
        setHover(null)
        return
      }
      const cell = matrix[hit.row][hit.col]
      setHover({
        ...hit,
        symbol: geneRows[hit.row].symbol,
        name: geneById.get(geneRows[hit.row].geneId)?.name ?? null,
        tissue: displayTissue(tissueCols[hit.col]),
        value: cell ? cell.tpm : null,
        clientX: e.clientX,
        clientY: e.clientY,
      })
    },
    [hitTest, geneRows, tissueCols, matrix, geneById],
  )

  const clearHover = useCallback(() => setHover(null), [])

  const { resetView, focusGene, focusFamily } = useRowFocus({
    containerRef,
    clusterNodes,
    geneRows,
    rowByGene,
    cellH,
    topH,
    selectedGeneId,
    containerW,
  })

  const { flashSpans, focusTissue, reduceMotion } = useTissueFlash({
    containerRef,
    tissueCols,
    cellW,
    leftColW,
  })

  const figure = () =>
    buildExpressionFigureSvg({
      geneTree,
      geneRows,
      labels: tissueCols.map(displayTissue),
      gridW,
      gridH,
      cellW,
      cellH,
      topH,
      geneLabelW,
      showGeneTree,
      fillFor: cellFill,
      geneDotR,
      geneFont,
      colFont: tissueFont,
      monoFont,
      muted,
      background: theme.palette.background.paper,
      gridLine: lineColor,
      mode,
    })
  const figureRef = useRef(figure)
  figureRef.current = figure
  const buildFigure = useCallback(() => figureRef.current(), [])

  const contentLeft = grid.fits ? Math.max(0, (containerW - grid.contentW) / 2) : 0
  const gridLeft = contentLeft + leftColW

  const settingsFloats = leftColW < CORNER_DROPDOWN_MIN_W

  const searchClearLeft = settingsFloats ? gridLeft : contentLeft
  const searchFloats = searchClearLeft < SEARCH_PANEL_CLEAR_X

  const {
    setCellWidth,
    finishCellWidthResize,
    setCellHeight,
    resetCellSize,
    fits: layoutFits,
    contentOffsetLeft,
    cornerCollapsed,
    searchCoversContent: visibleSearchFloats,
  } = useHeatmapResize(setCellSize, {
    fits: grid.fits,
    contentLeft,
    cornerCollapsed: settingsFloats,
    searchCoversContent: searchFloats,
  })

  return {
    containerRef,
    headerRef,
    canvasRef,
    headerH: header.h,
    containerH: container.h,
    monoFont,
    geneTree,
    geneRows,
    tissueCols,
    topH,
    tissueFont,
    leftColW,
    cellW,
    cellH,
    geneFont,
    geneDotR,
    geneLabelW,
    showLegend,
    setCellWidth,
    finishCellWidthResize,
    setCellHeight,
    resetCellSize,
    cornerCollapsed,
    searchCoversContent: visibleSearchFloats,
    contentW: grid.contentW,
    fits: layoutFits,
    contentOffsetLeft,
    gridW,
    gridH,
    selectedRow: grid.selectedRow,
    selectedOutline: grid.selectedOutline,
    pickGene: grid.pickGene,
    toggleCell: grid.toggleCell,
    hitTest,
    hover,
    onHover,
    clearHover,
    flashSpans,
    reduceMotion,
    resetView,
    focusGene,
    focusFamily,
    focusTissue,
    buildFigure,
  }
}
