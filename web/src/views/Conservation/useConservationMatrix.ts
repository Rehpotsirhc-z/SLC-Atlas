// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef, useState } from "react"
import type { MouseEvent } from "react"
import { useTheme } from "@mui/material"
import { useCellHitTest } from "@/components/heatmap/useCellHitTest"
import { useDendroLeaves, useGeneRows } from "@/components/heatmap/useGeneRows"
import { useHeatmapGrid } from "@/components/heatmap/useHeatmapGrid"
import { useHeatmapMetrics } from "@/components/heatmap/useHeatmapMetrics"
import { useHeatmapResize } from "@/components/heatmap/useHeatmapResize"
import { useMatrixCanvas } from "@/components/heatmap/useMatrixCanvas"
import { useRowFocus } from "@/components/heatmap/useRowFocus"
import type { CellHover } from "@/components/heatmap/types"
import { useUIStore } from "@/store/uiStore"
import { useElementSize } from "@/utils/useElementSize"
import type { ClusterNode } from "@/types/clustering"
import type { ConservationCell, SpeciesNode } from "@/types/conservation"
import { CELL_METRICS, type CellMetricKey } from "@/types/conservation"
import type { Gene } from "@/types/gene"
import {
  COL_LABEL_GAP,
  CORNER_DROPDOWN_MIN_W,
  CORNER_INLINE_MIN_H,
  MONO_CHAR_W,
  SEARCH_PANEL_CLEAR_X,
  SEARCH_PANEL_CLEAR_Y,
} from "@/components/heatmap/constants"
import { SP_TREE_PAD, SPECIES_LABEL_MIN_H, SPECIES_TREE_H } from "./constants"
import { buildConservationFigureSvg } from "./conservationFigureSvg"
import { useConservationCellFill } from "./useConservationColor"

export interface SpeciesCol {
  species: string
  label: string
}

export interface ConservationHoverState extends CellHover {
  symbol: string
  name: string | null
  speciesLabel: string
  value: number | null
  cell: ConservationCell | undefined
}

interface Options {
  cells: ConservationCell[]
  clusterNodes: ClusterNode[]
  speciesNodes: SpeciesNode[]
  metric: CellMetricKey
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
  showSpeciesTree: boolean
  showGeneTree: boolean
  hasLegend: boolean
  searchInCorner: boolean
}

const conservationKey = (c: ConservationCell) => `${c.gene_id}__${c.species}`
const speciesKey = (s: SpeciesCol) => s.species

export function useConservationMatrix({
  cells,
  clusterNodes,
  speciesNodes,
  metric,
  familyFilter,
  selectedGeneId,
  onSelect,
  geneById,
  showSpeciesTree,
  showGeneTree,
  hasLegend,
  searchInCorner,
}: Options) {
  const theme = useTheme()
  const mode = theme.palette.mode
  const monoFont = theme.custom.monoFontFamily
  const muted = theme.palette.text.secondary
  const lineColor = theme.palette.divider
  const [containerRef, container] = useElementSize<HTMLDivElement>()
  const [headerRef, header] = useElementSize<HTMLDivElement>("offset")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<ConservationHoverState | null>(null)
  const containerW = container.w

  const metricDef = useMemo(() => CELL_METRICS.find((m) => m.key === metric)!, [metric])

  const nSpecies = useMemo(() => speciesNodes.filter((n) => n.species).length, [speciesNodes])

  const cellSize = useUIStore((s) => s.conservationCellSize)
  const setCellSize = useUIStore((s) => s.setConservationCellSize)
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
    colFont: speciesFont,
    legendReserve,
    showLegend,
  } = useHeatmapMetrics(containerW, nSpecies, hasLegend, showGeneTree, cellSize, maxGeneLabelLength)

  const { geneTree, geneRows, rowByGene } = useGeneRows(clusterNodes, cellH)

  const { tree: speciesTree, items: speciesCols } = useDendroLeaves(
    speciesNodes,
    "top",
    cellW,
    SPECIES_TREE_H - SP_TREE_PAD,
    (n): SpeciesCol | null =>
      n.species ? { species: n.species, label: n.species_label ?? n.species } : null,
  )

  const grid = useHeatmapGrid({
    cells,
    cellKey: conservationKey,
    cols: speciesCols,
    colKey: speciesKey,
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

  const speciesLabelH = useMemo(() => {
    if (!speciesCols.length) return SPECIES_LABEL_MIN_H
    const maxLabelLength = Math.max(...speciesCols.map((s) => s.label.length))
    return Math.max(
      SPECIES_LABEL_MIN_H,
      Math.ceil(maxLabelLength * speciesFont * MONO_CHAR_W) + COL_LABEL_GAP + 4,
    )
  }, [speciesCols, speciesFont])

  const topH = showSpeciesTree ? SPECIES_TREE_H + speciesLabelH : speciesLabelH

  const contentLeft = grid.fits ? Math.max(0, (containerW - grid.contentW) / 2) : 0
  const gridLeft = contentLeft + leftColW

  const shouldCollapseCorner =
    leftColW < CORNER_DROPDOWN_MIN_W ||
    (searchInCorner && topH < CORNER_INLINE_MIN_H && contentLeft < SEARCH_PANEL_CLEAR_X)

  const searchCoversContent =
    gridLeft < SEARCH_PANEL_CLEAR_X ||
    (topH < SEARCH_PANEL_CLEAR_Y && contentLeft < SEARCH_PANEL_CLEAR_X)

  const {
    setCellWidth,
    finishCellWidthResize,
    setCellHeight,
    resetCellSize,
    fits: layoutFits,
    contentOffsetLeft,
    cornerCollapsed,
    searchCoversContent: visibleSearchCoversContent,
  } = useHeatmapResize(setCellSize, {
    fits: grid.fits,
    contentLeft,
    cornerCollapsed: shouldCollapseCorner,
    searchCoversContent,
  })

  const cellFill = useConservationCellFill(matrix, metricDef)

  useMatrixCanvas({
    canvasRef,
    nRows: matrix.length,
    nCols: speciesCols.length,
    gridW,
    gridH,
    cellW,
    cellH,
    background: lineColor,
    fillFor: cellFill,
    alphaFor: grid.rowAlpha,
    cellYOffset: 0.5,
  })

  const hitTest = useCellHitTest(canvasRef, cellW, cellH, geneRows.length, speciesCols.length)

  const onHover = useCallback(
    (e: MouseEvent | null) => {
      const hit = e && hitTest(e)
      if (!e || !hit) {
        setHover(null)
        return
      }
      const cell = matrix[hit.row][hit.col]
      const value = cell ? (cell[metricDef.field] as number | null) : null
      setHover({
        ...hit,
        symbol: geneRows[hit.row].symbol,
        name: geneById.get(geneRows[hit.row].geneId)?.name ?? null,
        speciesLabel: speciesCols[hit.col].label,
        value: cell && cell.orthology_type !== null ? value : null,
        cell,
        clientX: e.clientX,
        clientY: e.clientY,
      })
    },
    [hitTest, geneRows, speciesCols, matrix, metricDef, geneById],
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

  const figure = () =>
    buildConservationFigureSvg({
      geneTree,
      speciesTree,
      geneRows,
      labels: speciesCols.map((s) => s.label),
      topH,
      geneLabelW,
      showGeneTree,
      showSpeciesTree,
      gridW,
      gridH,
      cellW,
      cellH,
      fillFor: cellFill,
      geneDotR,
      geneFont,
      colFont: speciesFont,
      monoFont,
      muted,
      background: theme.palette.background.paper,
      gridLine: lineColor,
      mode,
    })
  const figureRef = useRef(figure)
  figureRef.current = figure
  const buildFigure = useCallback(() => figureRef.current(), [])

  return {
    containerRef,
    headerRef,
    canvasRef,
    headerH: header.h,
    containerH: container.h,
    monoFont,
    metricLabel: metricDef.label,
    geneTree,
    geneRows,
    speciesTree,
    speciesCols,
    speciesFont,
    speciesLabelH,
    containerW,
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
    searchCoversContent: visibleSearchCoversContent,
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
    resetView,
    focusGene,
    focusFamily,
    buildFigure,
  }
}
