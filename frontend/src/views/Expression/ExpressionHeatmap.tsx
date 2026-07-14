// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { MouseEvent } from "react"
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import HoverTooltip from "@/components/HoverTooltip"
import { computeDendrogram } from "@/utils/dendrogram"
import { getFamilyColor } from "@/utils/familyColor"
import { triggerDownload } from "@/utils/download"
import { displayTissue, sortedTissues } from "@/utils/tissue"
import { useTpmColorScale } from "@/utils/tpmColor"
import type { ExpressionRow } from "@/types/expression"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"

const MIN_CELL_W = 22
const MAX_CELL_W = 44
const ROW_H_MIN = 16
const ROW_H_MAX = 34
const GENE_TREE_W = 120
const GENE_LABEL_W = 92
const TISSUE_LABEL_H_MIN = 100
const LEFT_W = GENE_TREE_W + GENE_LABEL_W
const LEFT_GUTTER = 12
const LEFT_COL_W = LEFT_W + LEFT_GUTTER
const GENE_LABEL_GAP = 10
const TISSUE_LABEL_GAP = 8
const BOTTOM_PAD = 72
const RIGHT_PAD = 14

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
}

interface GeneRow {
  geneId: string
  symbol: string
  family: string | null
}

function formatTpm(value: number): string {
  return value < 10 ? value.toFixed(2) : value.toFixed(1)
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
    { rows, clusterNodes, familyFilter, selectedGeneId, onSelect, geneById, cornerSlot },
    ref,
  ) {
    const theme = useTheme()
    const mode = theme.palette.mode
    const monoFont = theme.custom.monoFontFamily
    const muted = theme.palette.text.secondary
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hover, setHover] = useState<HoverState | null>(null)
    const [containerW, setContainerW] = useState(0)
    const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
    const [flashCols, setFlashCols] = useState<Set<number>>(new Set())
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")

    // Group adjacent flashed columns into one span
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

    useLayoutEffect(() => {
      const el = containerRef.current
      if (!el) return
      const update = () => setContainerW(el.clientWidth)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    const tissueCols = useMemo(() => sortedTissues(rows), [rows])

    const nTissues = tissueCols.length
    const cellW = useMemo(() => {
      if (!nTissues || !containerW) return MIN_CELL_W
      const avail = containerW - LEFT_COL_W
      return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.floor(avail / nTissues)))
    }, [containerW, nTissues])
    const cellH = Math.max(ROW_H_MIN, Math.min(ROW_H_MAX, Math.round(cellW * 0.8)))
    const geneFont = Math.max(10, Math.min(13, Math.round(cellH * 0.5)))
    const geneDotR = geneFont * (4.5 / 13)
    const tissueFont = Math.max(11, Math.min(13, Math.round(cellW * 0.3)))

    // Rotated tissue labels vary a lot in length (esp. brain subregion names) —
    // size the label band to the longest one actually shown, not a fixed constant.
    const topH = useMemo(() => {
      if (!tissueCols.length) return TISSUE_LABEL_H_MIN
      const maxLen = Math.max(...tissueCols.map((t) => displayTissue(t).length))
      return Math.max(
        TISSUE_LABEL_H_MIN,
        Math.ceil(maxLen * tissueFont * 0.62) + TISSUE_LABEL_GAP + 4,
      )
    }, [tissueCols, tissueFont])

    // Gene rows ordered by the RNA co-expression clustering dendrogram
    const geneTree = useMemo(
      () => computeDendrogram(clusterNodes, "left", cellH, GENE_TREE_W),
      [clusterNodes, cellH],
    )
    const clusterMeta = useMemo(() => {
      const m = new Map<number, ClusterNode>()
      for (const n of clusterNodes) m.set(n.node_id, n)
      return m
    }, [clusterNodes])
    const geneRows: GeneRow[] = useMemo(() => {
      if (!geneTree) return []
      return geneTree.order
        .map((id) => clusterMeta.get(id))
        .filter((n): n is ClusterNode => !!n?.gene_id)
        .map((n) => ({
          geneId: n.gene_id as string,
          symbol: n.symbol ?? n.gene_id!,
          family: n.family,
        }))
    }, [geneTree, clusterMeta])

    const cellMap = useMemo(() => {
      const m = new Map<string, ExpressionRow>()
      for (const r of rows) m.set(`${r.gene_id}__${r.tissue}`, r)
      return m
    }, [rows])

    const matrix = useMemo(() => {
      return geneRows.map((g) => tissueCols.map((t) => cellMap.get(`${g.geneId}__${t}`)))
    }, [geneRows, tissueCols, cellMap])

    const rowByGene = useMemo(() => {
      const m = new Map<string, number>()
      geneRows.forEach((g, i) => m.set(g.geneId, i))
      return m
    }, [geneRows])

    const { colorFor } = useTpmColorScale(rows)

    const gridW = tissueCols.length * cellW
    const gridH = geneRows.length * cellH
    const fits = containerW > 0 && LEFT_COL_W + gridW + RIGHT_PAD <= containerW
    const selectedRow = selectedGeneId ? (rowByGene.get(selectedGeneId) ?? null) : null
    const selectedCol =
      selectedCell !== null && selectedCell.row === selectedRow ? selectedCell.col : null

    const lineColor = theme.palette.divider

    const tissueHeader = useMemo(
      () => (
        <svg
          width={gridW + RIGHT_PAD}
          height={topH}
          style={{ display: "block", overflow: "visible" }}
        >
          {tissueCols.map((t, i) => {
            const x = i * cellW + cellW / 2
            const y = TISSUE_LABEL_GAP
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
              >
                {displayTissue(t)}
              </text>
            )
          })}
        </svg>
      ),
      [tissueCols, gridW, cellW, tissueFont, muted, monoFont, topH],
    )

    const geneSidebar = useMemo(
      () => (
        <svg width={LEFT_W} height={gridH} style={{ display: "block" }}>
          <path d={geneTree?.edges} stroke={muted} strokeWidth={0.7} fill="none" />
          {geneRows.map((g, i) => {
            const opacity =
              (familyFilter !== null && g.family !== familyFilter ? 0.25 : 1) *
              (selectedRow !== null && i !== selectedRow ? 0.35 : 1)
            const handleClick = (e: MouseEvent) => {
              e.stopPropagation()
              const deselecting = g.geneId === selectedGeneId
              onSelect(deselecting ? null : g.geneId)
              setSelectedCell(null)
            }
            return (
              <g key={g.geneId} style={{ cursor: "pointer" }} onClick={handleClick}>
                <circle
                  cx={GENE_TREE_W}
                  cy={i * cellH + cellH / 2}
                  r={geneDotR}
                  fill={getFamilyColor(g.family ?? "?", mode)}
                  opacity={opacity}
                />
                <text
                  x={GENE_TREE_W + GENE_LABEL_GAP}
                  y={i * cellH + cellH / 2 + geneFont * 0.28}
                  fontSize={geneFont}
                  fontFamily={monoFont}
                  fill={getFamilyColor(g.family ?? "?", mode)}
                  opacity={opacity}
                >
                  {g.symbol}
                </text>
              </g>
            )
          })}
        </svg>
      ),
      [
        geneTree,
        geneRows,
        gridH,
        cellH,
        geneFont,
        geneDotR,
        selectedRow,
        familyFilter,
        selectedGeneId,
        onSelect,
        mode,
        muted,
        monoFont,
      ],
    )

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || gridW === 0 || gridH === 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = gridW * dpr
      canvas.height = gridH * dpr
      const ctx = canvas.getContext("2d")!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = lineColor
      ctx.fillRect(0, 0, gridW, gridH)
      for (let r = 0; r < matrix.length; r++) {
        const familyDim = familyFilter !== null && geneRows[r].family !== familyFilter
        const rowDim = selectedRow !== null && r !== selectedRow
        const row = matrix[r]
        for (let c = 0; c < row.length; c++) {
          let a = familyDim ? 0.15 : 1
          if (rowDim) a *= 0.3
          ctx.globalAlpha = a
          const cell = row[c]
          ctx.fillStyle = colorFor(cell ? cell.tpm : null)
          ctx.fillRect(c * cellW, r * cellH + 0.5, cellW - 1, cellH - 1)
        }
      }
      ctx.globalAlpha = 1
    }, [
      matrix,
      geneRows,
      familyFilter,
      selectedRow,
      colorFor,
      lineColor,
      gridW,
      gridH,
      cellW,
      cellH,
    ])

    const cellFromEvent = useCallback(
      (e: React.PointerEvent): HoverState | null => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return null
        const cr = canvas.getBoundingClientRect()
        const col = Math.floor((e.clientX - cr.left) / cellW)
        const row = Math.floor((e.clientY - cr.top) / cellH)
        if (row < 0 || row >= geneRows.length || col < 0 || col >= tissueCols.length) return null
        const cell = matrix[row][col]
        return {
          row,
          col,
          symbol: geneRows[row].symbol,
          name: geneById.get(geneRows[row].geneId)?.name ?? null,
          tissue: displayTissue(tissueCols[col]),
          value: cell ? cell.tpm : null,
          clientX: e.clientX,
          clientY: e.clientY,
        }
      },
      [geneRows, tissueCols, matrix, geneById, cellW, cellH],
    )

    const scrollToRow = useCallback(
      (row: number) => {
        const c = containerRef.current
        if (!c) return
        c.scrollTo({ top: topH + row * cellH - c.clientHeight / 2, behavior: "smooth" })
      },
      [cellH, topH],
    )

    const focusTissue = useCallback(
      (tissue: string | string[]) => {
        const cols = (Array.isArray(tissue) ? tissue : [tissue])
          .map((t) => tissueCols.indexOf(t))
          .filter((col) => col >= 0)
        if (cols.length === 0) return
        const c = containerRef.current
        if (c) {
          // Center the midpoint of the focused columns' span within the tissue area
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
      [tissueCols, cellW, reduceMotion],
    )

    useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), [])

    const lastFocus = useRef<{ nodes: ClusterNode[]; gene: string } | null>(null)
    useEffect(() => {
      if (!selectedGeneId || containerW === 0) return
      const row = rowByGene.get(selectedGeneId)
      if (row === undefined) return
      if (lastFocus.current?.nodes === clusterNodes && lastFocus.current?.gene === selectedGeneId)
        return
      lastFocus.current = { nodes: clusterNodes, gene: selectedGeneId }
      scrollToRow(row)
    }, [clusterNodes, selectedGeneId, rowByGene, scrollToRow, containerW])

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
        focusGene: (geneId) => {
          const r = rowByGene.get(geneId)
          if (r !== undefined) scrollToRow(r)
        },
        focusFamily: (family) => {
          const rowIdxs = geneRows.flatMap((g, i) => (g.family === family ? [i] : []))
          if (rowIdxs.length) scrollToRow(rowIdxs[Math.floor(rowIdxs.length / 2)])
        },
        focusTissue,
        exportSvg: (filename) => {
          const svg = buildFigureSvg()
          if (svg)
            triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename)
        },
        exportPng: (filename) => {
          const svg = buildFigureSvg()
          if (!svg) return
          const w = LEFT_W + gridW + RIGHT_PAD
          const h = topH + gridH
          const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = w * 2
            canvas.height = h * 2
            const ctx = canvas.getContext("2d")!
            ctx.scale(2, 2)
            ctx.drawImage(img, 0, 0)
            canvas.toBlob((blob) => {
              if (blob) triggerDownload(blob, filename)
              URL.revokeObjectURL(url)
            }, "image/png")
          }
          img.src = url
        },
      }),
      [rowByGene, geneRows, scrollToRow, focusTissue, gridW, gridH, topH, matrix, mode],
    )

    function buildFigureSvg(): string | null {
      if (!geneTree || gridW === 0) return null
      const w = LEFT_W + gridW + RIGHT_PAD
      const h = topH + gridH
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      const rects: string[] = []
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          const cell = matrix[r][c]
          const fill = colorFor(cell ? cell.tpm : null)
          rects.push(
            `<rect x="${LEFT_W + c * cellW}" y="${topH + r * cellH}" width="${cellW - 1}" height="${cellH - 1}" fill="${fill}"/>`,
          )
        }
      }
      const geneLabels = geneRows
        .map((g, i) => {
          const color = getFamilyColor(g.family ?? "?", mode)
          const cy = topH + i * cellH + cellH / 2
          const circle = `<circle cx="${GENE_TREE_W}" cy="${cy}" r="${geneDotR}" fill="${color}"/>`
          const text = `<text x="${GENE_TREE_W + GENE_LABEL_GAP}" y="${cy + geneFont * 0.28}" font-size="${geneFont}" font-family="${monoFont}" fill="${color}">${esc(g.symbol)}</text>`
          return circle + text
        })
        .join("")
      const tissueLabels = tissueCols
        .map((t, i) => {
          const x = LEFT_W + i * cellW + cellW / 2
          const y = TISSUE_LABEL_GAP
          return `<text x="${x}" y="${y}" font-size="${tissueFont}" font-family="${monoFont}" fill="${muted}" text-anchor="start" dominant-baseline="central" transform="rotate(90 ${x} ${y})">${esc(displayTissue(t))}</text>`
        })
        .join("")
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<rect width="${w}" height="${h}" fill="${theme.palette.background.paper}"/>` +
        `<path transform="translate(0 ${topH})" d="${geneTree.edges}" stroke="${muted}" stroke-width="0.7" fill="none"/>` +
        rects.join("") +
        geneLabels +
        tissueLabels +
        `</svg>`
      )
    }

    if (!geneTree || geneRows.length === 0 || tissueCols.length === 0) {
      return (
        <Box
          sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Typography color="text.secondary">No expression data to display.</Typography>
        </Box>
      )
    }

    const stickyBg = theme.palette.background.paper

    return (
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "auto",
        }}
        onPointerLeave={() => setHover(null)}
        onClick={() => {
          onSelect(null)
          setSelectedCell(null)
        }}
      >
        <Box
          sx={{
            width: LEFT_COL_W + gridW + RIGHT_PAD,
            ml: fits ? "auto" : 0,
            mr: fits ? "auto" : 0,
          }}
        >
          <Box sx={{ position: "sticky", top: 0, zIndex: 3, display: "flex", bgcolor: stickyBg }}>
            <Box
              sx={{
                position: fits ? "static" : "sticky",
                left: 0,
                zIndex: 1,
                width: LEFT_COL_W,
                pl: LEFT_GUTTER / 8,
                flexShrink: 0,
                bgcolor: stickyBg,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {cornerSlot}
            </Box>
            {tissueHeader}
          </Box>

          <Box sx={{ display: "flex" }}>
            <Box
              sx={{
                position: fits ? "static" : "sticky",
                left: 0,
                zIndex: 2,
                width: LEFT_COL_W,
                pl: LEFT_GUTTER / 8,
                flexShrink: 0,
                bgcolor: stickyBg,
              }}
            >
              {geneSidebar}
            </Box>

            <Box sx={{ position: "relative", width: gridW, height: gridH, flexShrink: 0 }}>
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: gridW, height: gridH, cursor: "pointer" }}
                onPointerMove={(e) => setHover(cellFromEvent(e))}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (hover) {
                    const deselecting =
                      selectedCell !== null &&
                      selectedCell.row === hover.row &&
                      selectedCell.col === hover.col
                    if (deselecting) {
                      onSelect(null)
                      setSelectedCell(null)
                    } else {
                      onSelect(geneRows[hover.row].geneId)
                      setSelectedCell({ row: hover.row, col: hover.col })
                    }
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
                    boxShadow: `inset 0 0 0 2px ${theme.palette.secondary.main}`,
                    bgcolor: alpha(theme.palette.secondary.main, 0.12),
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
                <Box
                  sx={{
                    position: "absolute",
                    left: selectedCol * cellW,
                    top: selectedRow * cellH + 0.5,
                    width: cellW - 1,
                    height: cellH - 1,
                    pointerEvents: "none",
                    zIndex: 2,
                    boxShadow: `inset 0 0 0 2px ${theme.palette.secondary.main}`,
                  }}
                />
              )}
              {hover && (
                <Box
                  sx={{
                    position: "absolute",
                    left: hover.col * cellW,
                    top: hover.row * cellH + 0.5,
                    width: cellW - 1,
                    height: cellH - 1,
                    pointerEvents: "none",
                    boxShadow: `inset 0 0 0 2px ${theme.palette.secondary.main}`,
                  }}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ height: BOTTOM_PAD }} />
        </Box>

        {hover && <HoverTip hover={hover} monoFont={monoFont} />}
      </Box>
    )
  },
)

export default ExpressionHeatmap
