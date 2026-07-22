// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react"
import { Box, Typography, useTheme } from "@mui/material"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import HoverTooltip from "@/components/HoverTooltip"
import CellOutline from "@/components/heatmap/CellOutline"
import GeneSidebar from "@/components/heatmap/GeneSidebar"
import HeatmapShell from "@/components/heatmap/HeatmapShell"
import { COL_LABEL_GAP, LEFT_COL_W, LEFT_W, RIGHT_PAD } from "@/components/heatmap/constants"
import {
  cellRectsSvg,
  columnLabelsSvg,
  figureSvgDocument,
  geneLabelsSvg,
  svgFontFamily,
  treePathSvg,
} from "@/components/heatmap/figureSvg"
import { useCellHitTest } from "@/components/heatmap/useCellHitTest"
import { useElementSize } from "@/utils/useElementSize"
import { useDendroLeaves, useGeneRows } from "@/components/heatmap/useGeneRows"
import { useHeatmapMetrics } from "@/components/heatmap/useHeatmapMetrics"
import { useMatrixCanvas } from "@/components/heatmap/useMatrixCanvas"
import { useRowFocus } from "@/components/heatmap/useRowFocus"
import { figureExportHandlers } from "@/utils/exportFigure"
import type { ConservationCell, SpeciesNode } from "@/types/conservation"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"

export const CELL_METRICS = [
  { key: "perc_id", label: "% identity", field: "perc_id", domain: [0, 100] },
  { key: "perc_pos", label: "% positives", field: "perc_pos", domain: [0, 100] },
] as const

export type CellMetricKey = (typeof CELL_METRICS)[number]["key"]

const SPECIES_TREE_H = 100
const SPECIES_LABEL_H = 134
const SPECIES_TOGGLE_H = 14
const TOP_H = SPECIES_TREE_H + SPECIES_LABEL_H
const SP_TREE_PAD = 20
const COLLAPSED_CORNER_H = 163

export interface ConservationHeatmapHandle {
  resetView: () => void
  focusGene: (geneId: string) => void
  focusFamily: (family: string) => void
  exportSvg: (filename: string) => void
  exportPng: (filename: string) => void
}

interface ConservationHeatmapProps {
  cells: ConservationCell[]
  clusterNodes: ClusterNode[]
  speciesNodes: SpeciesNode[]
  metric: CellMetricKey
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
  cornerSlot?: React.ReactNode
  showSpeciesTree?: boolean
  onToggleSpeciesTree?: () => void
  legendSlot?: React.ReactNode
}

function hexToRgb(hex: string): [number, number, number] {
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

const HoverTip = ({
  hover,
  metricLabel,
  monoFont,
}: {
  hover: HoverState
  metricLabel: string
  monoFont: string
}) => (
  <HoverTooltip x={hover.clientX} y={hover.clientY}>
    <Typography
      variant="caption"
      sx={{ fontFamily: monoFont, display: "block", fontWeight: 600, fontSize: 13 }}
    >
      {hover.symbol}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
        {"  ×  "}
      </Box>
      {hover.speciesLabel}
    </Typography>
    {hover.name && (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "justify" }}>
        {hover.name}
      </Typography>
    )}
    {hover.cell && hover.value !== null ? (
      <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontSize: 13 }}>
        {metricLabel}:{" "}
        <Box component="span" sx={{ fontFamily: monoFont, fontWeight: 600 }}>
          {hover.value.toFixed(1)}%
        </Box>
        <Box component="span" sx={{ color: "text.secondary" }}>
          {hover.cell.orthology_type && ` · ${hover.cell.orthology_type.replace(/_/g, " ")}`}
          {hover.cell.ortholog_count > 1 && ` · ${hover.cell.ortholog_count} orthologs`}
        </Box>
      </Typography>
    ) : (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
        No ortholog
      </Typography>
    )}
  </HoverTooltip>
)

interface HoverState {
  row: number
  col: number
  symbol: string
  name: string | null
  speciesLabel: string
  value: number | null
  cell: ConservationCell | undefined
  clientX: number
  clientY: number
}

const ConservationHeatmap = forwardRef<ConservationHeatmapHandle, ConservationHeatmapProps>(
  function ConservationHeatmap(
    {
      cells,
      clusterNodes,
      speciesNodes,
      metric,
      familyFilter,
      selectedGeneId,
      onSelect,
      geneById,
      cornerSlot,
      showSpeciesTree = true,
      onToggleSpeciesTree,
      legendSlot,
    },
    ref,
  ) {
    const theme = useTheme()
    const mode = theme.palette.mode
    const monoFont = theme.custom.monoFontFamily
    const muted = theme.palette.text.secondary
    const [containerRef, container] = useElementSize<HTMLDivElement>()
    const [headerRef, header] = useElementSize<HTMLDivElement>("offset")
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hover, setHover] = useState<HoverState | null>(null)
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
    const containerW = container.w

    const metricDef = useMemo(() => CELL_METRICS.find((m) => m.key === metric)!, [metric])

    const nSpecies = useMemo(() => speciesNodes.filter((n) => n.species).length, [speciesNodes])

    const {
      cellW,
      cellH,
      geneFont,
      geneDotR,
      colFont: speciesFont,
      legendReserve,
      showLegend,
    } = useHeatmapMetrics(containerW, nSpecies, !!legendSlot)

    const { geneTree, geneRows, rowByGene } = useGeneRows(clusterNodes, cellH)

    const { tree: speciesTree, items: speciesCols } = useDendroLeaves(
      speciesNodes,
      "top",
      cellW,
      SPECIES_TREE_H - SP_TREE_PAD,
      (n) => (n.species ? { species: n.species, label: n.species_label ?? n.species } : null),
    )

    const cellMap = useMemo(() => {
      const m = new Map<string, ConservationCell>()
      for (const c of cells) m.set(`${c.gene_id}__${c.species}`, c)
      return m
    }, [cells])

    const matrix = useMemo(() => {
      return geneRows.map((g) => speciesCols.map((s) => cellMap.get(`${g.geneId}__${s.species}`)))
    }, [geneRows, speciesCols, cellMap])

    const gridW = speciesCols.length * cellW
    const gridH = geneRows.length * cellH
    const topH = showSpeciesTree ? TOP_H : SPECIES_LABEL_H
    const contentW = LEFT_COL_W + gridW + RIGHT_PAD + legendReserve
    const fits = containerW > 0 && contentW <= containerW
    const selectedRow = selectedGeneId ? (rowByGene.get(selectedGeneId) ?? null) : null
    const selectedCol =
      selectedCell !== null && selectedCell.row === selectedRow ? selectedCell.col : null

    const lineColor = theme.palette.divider
    const absentColor = theme.palette.background.paper

    const colorFor = useCallback(
      (value: number | null): string => {
        if (value === null) return absentColor
        const [lo, hi] = metricDef.domain
        const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)))
        const [br, bg, bb] = hexToRgb(theme.palette.background.paper)
        const [pr, pg, pb] = hexToRgb(theme.palette.primary.main)
        const r = Math.round(br + (pr - br) * t)
        const g = Math.round(bg + (pg - bg) * t)
        const b = Math.round(bb + (pb - bb) * t)
        return `rgb(${r},${g},${b})`
      },
      [metricDef, absentColor, theme.palette.background.paper, theme.palette.primary.main],
    )

    const cellFill = useCallback(
      (r: number, c: number) => {
        const cell = matrix[r][c]
        if (!cell || cell.orthology_type === null) return absentColor
        return colorFor(cell[metricDef.field] as number | null)
      },
      [matrix, metricDef, colorFor, absentColor],
    )

    const rowAlpha = useCallback(
      (r: number) => {
        let a = familyFilter !== null && geneRows[r].family !== familyFilter ? 0.15 : 1
        if (selectedRow !== null && r !== selectedRow) a *= 0.3
        return a
      },
      [familyFilter, geneRows, selectedRow],
    )

    const speciesHeader = useMemo(
      () => (
        <Box sx={{ position: "relative", display: "flex", flexDirection: "column" }}>
          {showSpeciesTree && (
            <svg width={gridW} height={SPECIES_TREE_H} style={{ display: "block" }}>
              <path
                transform={`translate(0 ${SP_TREE_PAD})`}
                d={speciesTree?.edges}
                stroke={muted}
                strokeWidth={0.7}
                fill="none"
              />
            </svg>
          )}
          <svg
            width={gridW + RIGHT_PAD}
            height={SPECIES_LABEL_H}
            style={{ display: "block", overflow: "visible" }}
          >
            {speciesCols.map((s, i) => {
              const x = i * cellW + cellW / 2
              const y = COL_LABEL_GAP
              return (
                <text
                  key={s.species}
                  x={x}
                  y={y}
                  fontSize={speciesFont}
                  fontFamily={monoFont}
                  fill={muted}
                  textAnchor="start"
                  dominantBaseline="central"
                  transform={`rotate(90 ${x} ${y})`}
                >
                  {s.label}
                </text>
              )
            })}
          </svg>
          {onToggleSpeciesTree && (
            <Box
              onClick={onToggleSpeciesTree}
              sx={{
                mt: "auto",
                flex: `0 0 ${SPECIES_TOGGLE_H}px`,
                height: SPECIES_TOGGLE_H,
                minHeight: SPECIES_TOGGLE_H,
                position: fits ? "static" : "sticky",
                left: LEFT_COL_W,
                width: Math.min(gridW + RIGHT_PAD, Math.max(0, containerW - LEFT_COL_W)),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 0,
                cursor: "pointer",
                color: "text.disabled",
              }}
            >
              {showSpeciesTree ? (
                <ExpandLessIcon sx={{ fontSize: 12, display: "block" }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 12, display: "block" }} />
              )}
            </Box>
          )}
        </Box>
      ),
      [
        showSpeciesTree,
        onToggleSpeciesTree,
        speciesTree,
        speciesCols,
        gridW,
        cellW,
        speciesFont,
        muted,
        monoFont,
        fits,
        containerW,
      ],
    )

    const pickGene = useCallback(
      (geneId: string | null) => {
        onSelect(geneId)
        setSelectedCell(null)
      },
      [onSelect],
    )

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
      alphaFor: rowAlpha,
      cellYOffset: 0.5,
    })

    const hitTest = useCellHitTest(canvasRef, cellW, cellH, geneRows.length, speciesCols.length)

    const hoverFromEvent = useCallback(
      (e: React.MouseEvent): HoverState | null => {
        const hit = hitTest(e)
        if (!hit) return null
        const cell = matrix[hit.row][hit.col]
        const value = cell ? (cell[metricDef.field] as number | null) : null
        return {
          ...hit,
          symbol: geneRows[hit.row].symbol,
          name: geneById.get(geneRows[hit.row].geneId)?.name ?? null,
          speciesLabel: speciesCols[hit.col].label,
          value: cell && cell.orthology_type !== null ? value : null,
          cell,
          clientX: e.clientX,
          clientY: e.clientY,
        }
      },
      [hitTest, geneRows, speciesCols, matrix, metricDef, geneById],
    )

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

    function buildFigureSvg(): string | null {
      if (!geneTree || !speciesTree || gridW === 0) return null
      const margin = RIGHT_PAD
      const contentTop = SP_TREE_PAD
      const svgFont = svgFontFamily(monoFont)
      return figureSvgDocument({
        width: LEFT_W + gridW + margin * 2,
        height: TOP_H - contentTop + gridH + margin * 2,
        margin,
        contentTop,
        background: theme.palette.background.paper,
        body:
          treePathSvg(geneTree.edges, 0, TOP_H, muted) +
          treePathSvg(speciesTree.edges, LEFT_W, SP_TREE_PAD, muted) +
          cellRectsSvg({
            nRows: matrix.length,
            nCols: speciesCols.length,
            y0: TOP_H,
            cellW,
            cellH,
            fillFor: cellFill,
          }) +
          geneLabelsSvg({ geneRows, y0: TOP_H, cellH, geneDotR, geneFont, svgFont, mode }) +
          columnLabelsSvg({
            labels: speciesCols.map((s) => s.label),
            y: SPECIES_TREE_H + COL_LABEL_GAP,
            cellW,
            font: speciesFont,
            svgFont,
            fill: muted,
          }),
      })
    }

    useImperativeHandle(
      ref,
      () => ({
        resetView,
        focusGene,
        focusFamily,
        ...figureExportHandlers(buildFigureSvg),
      }),
      [resetView, focusGene, focusFamily, gridW, gridH, matrix, metricDef, mode],
    )

    if (!geneTree || !speciesTree || geneRows.length === 0 || speciesCols.length === 0) {
      return (
        <Box
          sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Typography color="text.secondary">No conservation data to display.</Typography>
        </Box>
      )
    }

    return (
      <HeatmapShell
        containerRef={containerRef}
        headerRef={headerRef}
        contentW={contentW}
        fits={fits}
        cornerSlot={cornerSlot}
        cornerMinHeight={showSpeciesTree ? undefined : COLLAPSED_CORNER_H}
        headerSlot={speciesHeader}
        showLegend={showLegend}
        legendSlot={legendSlot}
        headerH={header.h}
        containerH={container.h}
        overlay={
          hover ? (
            <HoverTip hover={hover} metricLabel={metricDef.label} monoFont={monoFont} />
          ) : null
        }
        onPointerLeave={() => setHover(null)}
        onBackgroundClick={() => pickGene(null)}
        sidebar={
          <GeneSidebar
            geneTree={geneTree}
            geneRows={geneRows}
            familyFilter={familyFilter}
            selectedGeneId={selectedGeneId}
            selectedRow={selectedRow}
            cellH={cellH}
            geneFont={geneFont}
            geneDotR={geneDotR}
            height={gridH}
            onPick={pickGene}
          />
        }
      >
        <Box sx={{ position: "relative", zIndex: 0, width: gridW, height: gridH, flexShrink: 0 }}>
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: gridW, height: gridH, cursor: "pointer" }}
            onPointerMove={(e) => {
              if (e.pointerType === "touch") return
              setHover(hoverFromEvent(e))
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              e.stopPropagation()
              const hit = hitTest(e)
              if (!hit) return
              const deselecting =
                selectedCell !== null &&
                selectedCell.row === hit.row &&
                selectedCell.col === hit.col
              if (deselecting) {
                onSelect(null)
                setSelectedCell(null)
              } else {
                onSelect(geneRows[hit.row].geneId)
                setSelectedCell(hit)
              }
            }}
          />
          {selectedRow !== null && selectedCol !== null && (
            <CellOutline row={selectedRow} col={selectedCol} cellW={cellW} cellH={cellH} />
          )}
          {hover && <CellOutline row={hover.row} col={hover.col} cellW={cellW} cellH={cellH} />}
        </Box>
      </HeatmapShell>
    )
  },
)

export default ConservationHeatmap
