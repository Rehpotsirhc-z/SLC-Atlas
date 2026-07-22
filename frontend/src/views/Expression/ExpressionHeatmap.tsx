// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
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
import { useGeneRows } from "@/components/heatmap/useGeneRows"
import { useHeatmapMetrics } from "@/components/heatmap/useHeatmapMetrics"
import { useMatrixCanvas } from "@/components/heatmap/useMatrixCanvas"
import { useRowFocus } from "@/components/heatmap/useRowFocus"
import { figureExportHandlers } from "@/utils/exportFigure"
import { formatTpm } from "@/utils/format"
import { displayTissue, sortedTissues } from "@/utils/tissue"
import { useTpmColorScale } from "@/utils/tpmColor"
import type { ExpressionRow } from "@/types/expression"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"

const TISSUE_LABEL_H_MIN = 100

export interface ExpressionHeatmapHandle {
  resetView: () => void
  focusGene: (geneId: string) => void
  focusFamily: (family: string) => void
  focusTissue: (tissue: string | string[]) => void
  exportSvg: (filename: string) => void
  exportPng: (filename: string) => void
}

interface ExpressionHeatmapProps {
  rows: ExpressionRow[]
  clusterNodes: ClusterNode[]
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
  cornerSlot?: React.ReactNode
  onTissueClick?: (tissue: string) => void
  legendSlot?: React.ReactNode
}

interface HoverState {
  row: number
  col: number
  symbol: string
  name: string | null
  tissue: string
  value: number | null
  clientX: number
  clientY: number
}

const HoverTip = ({ hover, monoFont }: { hover: HoverState; monoFont: string }) => (
  <HoverTooltip x={hover.clientX} y={hover.clientY}>
    <Typography
      variant="caption"
      sx={{ fontFamily: monoFont, display: "block", fontWeight: 600, fontSize: 13 }}
    >
      {hover.symbol}
      <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
        {"  ×  "}
      </Box>
      {hover.tissue}
    </Typography>
    {hover.name && (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "justify" }}>
        {hover.name}
      </Typography>
    )}
    <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontSize: 13 }}>
      TPM:{" "}
      <Box component="span" sx={{ fontFamily: monoFont, fontWeight: 600 }}>
        {hover.value !== null ? formatTpm(hover.value) : "—"}
      </Box>
    </Typography>
  </HoverTooltip>
)

const ExpressionHeatmap = forwardRef<ExpressionHeatmapHandle, ExpressionHeatmapProps>(
  function ExpressionHeatmap(
    {
      rows,
      clusterNodes,
      familyFilter,
      selectedGeneId,
      onSelect,
      geneById,
      cornerSlot,
      onTissueClick,
      legendSlot,
    },
    ref,
  ) {
    const theme = useTheme()
    const mode = theme.palette.mode
    const monoFont = theme.custom.monoFontFamily
    const muted = theme.palette.text.secondary
    const accent = theme.palette.secondary.main
    const [containerRef, container] = useElementSize<HTMLDivElement>()
    const [headerRef, header] = useElementSize<HTMLDivElement>("offset")
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hover, setHover] = useState<HoverState | null>(null)
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
    const [hoverHeaderCol, setHoverHeaderCol] = useState<number | null>(null)
    const [flashCols, setFlashCols] = useState<Set<number>>(new Set())
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
    const containerW = container.w

    const flashSpans = useMemo(() => {
      const sorted = [...flashCols].sort((a, b) => a - b)
      const spans: [number, number][] = []
      for (const col of sorted) {
        const last = spans[spans.length - 1]
        if (last && col === last[1] + 1) last[1] = col
        else spans.push([col, col])
      }
      return spans
    }, [flashCols])

    const tissueCols = useMemo(() => sortedTissues(rows), [rows])

    const {
      cellW,
      cellH,
      geneFont,
      geneDotR,
      colFont: tissueFont,
      legendReserve,
      showLegend,
    } = useHeatmapMetrics(containerW, tissueCols.length, !!legendSlot)

    const topH = useMemo(() => {
      if (!tissueCols.length) return TISSUE_LABEL_H_MIN
      const maxLen = Math.max(...tissueCols.map((t) => displayTissue(t).length))
      return Math.max(TISSUE_LABEL_H_MIN, Math.ceil(maxLen * tissueFont * 0.62) + COL_LABEL_GAP + 4)
    }, [tissueCols, tissueFont])

    const { geneTree, geneRows, rowByGene } = useGeneRows(clusterNodes, cellH)

    const cellMap = useMemo(() => {
      const m = new Map<string, ExpressionRow>()
      for (const r of rows) m.set(`${r.gene_id}__${r.tissue}`, r)
      return m
    }, [rows])

    const matrix = useMemo(() => {
      return geneRows.map((g) => tissueCols.map((t) => cellMap.get(`${g.geneId}__${t}`)))
    }, [geneRows, tissueCols, cellMap])

    const { colorFor } = useTpmColorScale(rows)

    const gridW = tissueCols.length * cellW
    const gridH = geneRows.length * cellH
    const contentW = LEFT_COL_W + gridW + RIGHT_PAD + legendReserve
    const fits = containerW > 0 && contentW <= containerW
    const selectedRow = selectedGeneId ? (rowByGene.get(selectedGeneId) ?? null) : null
    const selectedCol =
      selectedCell !== null && selectedCell.row === selectedRow ? selectedCell.col : null

    const lineColor = theme.palette.divider

    const tissueHeaderBase = useMemo(
      () => (
        <>
          {onTissueClick &&
            tissueCols.map((t, i) => (
              <rect
                key={`hit-${t}`}
                x={i * cellW}
                y={0}
                width={cellW}
                height={topH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation()
                  onTissueClick(t)
                }}
                onPointerEnter={(e) => e.pointerType !== "touch" && setHoverHeaderCol(i)}
                onPointerLeave={() => setHoverHeaderCol((c) => (c === i ? null : c))}
              />
            ))}
          {tissueCols.map((t, i) => {
            const x = i * cellW + cellW / 2
            const y = COL_LABEL_GAP
            return (
              <text
                key={t}
                x={x}
                y={y}
                fontSize={tissueFont}
                fontFamily={monoFont}
                fill={muted}
                textAnchor="start"
                dominantBaseline="central"
                transform={`rotate(90 ${x} ${y})`}
                style={{ pointerEvents: "none" }}
              >
                {displayTissue(t)}
              </text>
            )
          })}
        </>
      ),
      [tissueCols, cellW, tissueFont, muted, monoFont, topH, onTissueClick],
    )

    const hoveredTissue = hoverHeaderCol !== null ? tissueCols[hoverHeaderCol] : undefined
    const hoverX = hoverHeaderCol !== null ? hoverHeaderCol * cellW + cellW / 2 : 0

    const tissueHeader = (
      <svg
        width={gridW + RIGHT_PAD}
        height={topH}
        style={{ display: "block", overflow: "visible" }}
      >
        {tissueHeaderBase}
        {hoverHeaderCol !== null && hoveredTissue && (
          <g style={{ pointerEvents: "none" }}>
            <rect
              x={hoverHeaderCol * cellW}
              y={0}
              width={cellW}
              height={topH}
              fill={alpha(accent, 0.12)}
            />
            <text
              x={hoverX}
              y={COL_LABEL_GAP}
              fontSize={tissueFont}
              fontFamily={monoFont}
              fill={accent}
              fontWeight={600}
              textAnchor="start"
              dominantBaseline="central"
              transform={`rotate(90 ${hoverX} ${COL_LABEL_GAP})`}
            >
              {displayTissue(hoveredTissue)}
            </text>
          </g>
        )}
      </svg>
    )

    const pickGene = useCallback(
      (geneId: string | null) => {
        onSelect(geneId)
        setSelectedCell(null)
      },
      [onSelect],
    )

    const cellFill = useCallback(
      (r: number, c: number) => {
        const cell = matrix[r][c]
        return colorFor(cell ? cell.tpm : null)
      },
      [matrix, colorFor],
    )

    const rowAlpha = useCallback(
      (r: number) => {
        let a = familyFilter !== null && geneRows[r].family !== familyFilter ? 0.15 : 1
        if (selectedRow !== null && r !== selectedRow) a *= 0.3
        return a
      },
      [familyFilter, geneRows, selectedRow],
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
      alphaFor: rowAlpha,
      axisLines: lineColor,
    })

    const hitTest = useCellHitTest(canvasRef, cellW, cellH, geneRows.length, tissueCols.length)

    const hoverFromEvent = useCallback(
      (e: React.MouseEvent): HoverState | null => {
        const hit = hitTest(e)
        if (!hit) return null
        const cell = matrix[hit.row][hit.col]
        return {
          ...hit,
          symbol: geneRows[hit.row].symbol,
          name: geneById.get(geneRows[hit.row].geneId)?.name ?? null,
          tissue: displayTissue(tissueCols[hit.col]),
          value: cell ? cell.tpm : null,
          clientX: e.clientX,
          clientY: e.clientY,
        }
      },
      [hitTest, geneRows, tissueCols, matrix, geneById],
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

    const focusTissue = useCallback(
      (tissue: string | string[]) => {
        const cols = (Array.isArray(tissue) ? tissue : [tissue])
          .map((t) => tissueCols.indexOf(t))
          .filter((col) => col >= 0)
        if (cols.length === 0) return
        const c = containerRef.current
        if (c) {
          const minCol = Math.min(...cols)
          const maxCol = Math.max(...cols)
          const midX = ((minCol + maxCol + 1) / 2) * cellW
          const target = midX - (c.clientWidth - LEFT_COL_W) / 2
          const max = c.scrollWidth - c.clientWidth
          c.scrollTo({
            left: Math.max(0, Math.min(max, target)),
            behavior: reduceMotion ? "auto" : "smooth",
          })
        }
        if (flashTimer.current) clearTimeout(flashTimer.current)
        setFlashCols(new Set(cols))
        flashTimer.current = setTimeout(() => setFlashCols(new Set()), reduceMotion ? 900 : 1200)
      },
      [containerRef, tissueCols, cellW, reduceMotion],
    )

    useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), [])

    function buildFigureSvg(): string | null {
      if (!geneTree || gridW === 0) return null
      const margin = RIGHT_PAD
      const contentTop = COL_LABEL_GAP
      const svgFont = svgFontFamily(monoFont)
      return figureSvgDocument({
        width: LEFT_W + gridW + margin * 2,
        height: topH - contentTop + gridH + margin * 2,
        margin,
        contentTop,
        background: theme.palette.background.paper,
        body:
          treePathSvg(geneTree.edges, 0, topH, muted) +
          cellRectsSvg({
            nRows: matrix.length,
            nCols: tissueCols.length,
            y0: topH,
            cellW,
            cellH,
            fillFor: cellFill,
          }) +
          geneLabelsSvg({ geneRows, y0: topH, cellH, geneDotR, geneFont, svgFont, mode }) +
          columnLabelsSvg({
            labels: tissueCols.map(displayTissue),
            y: COL_LABEL_GAP,
            cellW,
            font: tissueFont,
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
        focusTissue,
        ...figureExportHandlers(buildFigureSvg),
      }),
      [resetView, focusGene, focusFamily, focusTissue, gridW, gridH, topH, matrix, mode],
    )

    if (!geneTree || geneRows.length === 0 || tissueCols.length === 0) {
      return (
        <Box
          sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Typography color="text.secondary">No expression data to display.</Typography>
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
        headerSlot={tissueHeader}
        showLegend={showLegend}
        legendSlot={legendSlot}
        headerH={header.h}
        containerH={container.h}
        overlay={hover ? <HoverTip hover={hover} monoFont={monoFont} /> : null}
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
          {flashSpans.map(([start, end]) => (
            <Box
              key={start}
              sx={{
                position: "absolute",
                left: start * cellW,
                top: 0,
                width: (end - start + 1) * cellW,
                height: gridH,
                pointerEvents: "none",
                zIndex: 1,
                boxShadow: `inset 0 0 0 2px ${accent}`,
                bgcolor: alpha(accent, 0.12),
                ...(reduceMotion
                  ? {}
                  : {
                      animation: "tissueFlash 1.2s ease-out",
                      "@keyframes tissueFlash": {
                        "0%": { opacity: 0 },
                        "15%": { opacity: 1 },
                        "70%": { opacity: 0.55 },
                        "100%": { opacity: 0 },
                      },
                    }),
              }}
            />
          ))}
          {selectedRow !== null && selectedCol !== null && (
            <CellOutline
              row={selectedRow}
              col={selectedCol}
              cellW={cellW}
              cellH={cellH}
              zIndex={2}
            />
          )}
          {hover && <CellOutline row={hover.row} col={hover.col} cellW={cellW} cellH={cellH} />}
        </Box>
      </HeatmapShell>
    )
  },
)

export default ExpressionHeatmap
