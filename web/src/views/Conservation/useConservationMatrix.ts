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
import { useMatrixCanvas } from "@/components/heatmap/useMatrixCanvas"
import { useRowFocus } from "@/components/heatmap/useRowFocus"
import type { CellHover } from "@/components/heatmap/types"
import { useElementSize } from "@/utils/useElementSize"
import type { ClusterNode } from "@/types/clustering"
import type { ConservationCell, SpeciesNode } from "@/types/conservation"
import { CELL_METRICS, type CellMetricKey } from "@/types/conservation"
import type { Gene } from "@/types/gene"
import { SP_TREE_PAD, SPECIES_LABEL_H, SPECIES_TREE_H, TOP_H } from "./constants"
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

  const {
    leftColW,
    cellW,
    cellH,
    geneFont,
    geneDotR,
    colFont: speciesFont,
    legendReserve,
    showLegend,
  } = useHeatmapMetrics(containerW, nSpecies, hasLegend, showGeneTree)

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

  const topH = showSpeciesTree ? TOP_H : SPECIES_LABEL_H

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
    containerW,
    leftColW,
    cellW,
    cellH,
    geneFont,
    geneDotR,
    showLegend,
    contentW: grid.contentW,
    fits: grid.fits,
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
