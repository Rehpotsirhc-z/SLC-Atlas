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
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import { alpha } from "@mui/material/styles"
import { computeDendrogram } from "@/utils/dendrogram"
import { getFamilyColor } from "@/utils/familyColor"
import { triggerDownload } from "@/utils/download"
import type { ConservationCell, SpeciesNode } from "@/types/conservation"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"

export const CELL_METRICS = [
  { key: "perc_id", label: "% identity", field: "perc_id", domain: [0, 100] },
  { key: "perc_pos", label: "% positives", field: "perc_pos", domain: [0, 100] },
] as const

export type CellMetricKey = (typeof CELL_METRICS)[number]["key"]

const MIN_CELL_W = 22
const MAX_CELL_W = 44
const ROW_H_MIN = 16
const ROW_H_MAX = 34
const GENE_TREE_W = 120
const GENE_LABEL_W = 92
const SPECIES_TREE_H = 100
const SPECIES_LABEL_H = 134
const SPECIES_TOGGLE_H = 14
const LEFT_W = GENE_TREE_W + GENE_LABEL_W
const LEFT_GUTTER = 12
const LEFT_COL_W = LEFT_W + LEFT_GUTTER
const TOP_H = SPECIES_TREE_H + SPECIES_LABEL_H
const GENE_LABEL_GAP = 10
const SP_LABEL_GAP = 8
const BOTTOM_PAD = 72
const RIGHT_PAD = 14
const SP_TREE_PAD = 20

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
}

interface GeneRow {
  geneId: string
  symbol: string
  family: string | null
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
  <Box
    sx={{
      position: "absolute",
      left: hover.tipX + 14,
      top: hover.tipY + 14,
      pointerEvents: "none",
      zIndex: 10,
      bgcolor: "background.default",
      border: 1,
      borderColor: "divider",
      borderRadius: 1,
      px: 1,
      py: 0.5,
      maxWidth: 260,
      boxShadow: 3,
    }}
  >
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
  </Box>
)

interface HoverState {
  row: number
  col: number
  symbol: string
  name: string | null
  speciesLabel: string
  value: number | null
  cell: ConservationCell | undefined
  tipX: number
  tipY: number
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
    },
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

    useLayoutEffect(() => {
      const el = containerRef.current
      if (!el) return
      const update = () => setContainerW(el.clientWidth)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    const metricDef = useMemo(() => CELL_METRICS.find((m) => m.key === metric)!, [metric])

    const nSpecies = useMemo(() => speciesNodes.filter((n) => n.species).length, [speciesNodes])
    const cellW = useMemo(() => {
      if (!nSpecies || !containerW) return MIN_CELL_W
      const avail = containerW - LEFT_COL_W
      return Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, Math.floor(avail / nSpecies)))
    }, [containerW, nSpecies])
    const cellH = Math.max(ROW_H_MIN, Math.min(ROW_H_MAX, Math.round(cellW * 0.8)))
    const geneFont = Math.max(10, Math.min(13, Math.round(cellH * 0.5)))
    const speciesFont = Math.max(11, Math.min(13, Math.round(cellW * 0.3)))

    // Gene rows ordered by the clustering dendrogram leaf order
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

    // Species columns ordered by the species dendrogram leaf order
    const speciesTree = useMemo(
      () => computeDendrogram(speciesNodes, "top", cellW, SPECIES_TREE_H - SP_TREE_PAD),
      [speciesNodes, cellW],
    )
    const speciesMeta = useMemo(() => {
      const m = new Map<number, SpeciesNode>()
      for (const n of speciesNodes) m.set(n.node_id, n)
      return m
    }, [speciesNodes])
    const speciesCols = useMemo(() => {
      if (!speciesTree) return []
      return speciesTree.order
        .map((id) => speciesMeta.get(id))
        .filter((n): n is SpeciesNode => !!n?.species)
        .map((n) => ({ species: n.species as string, label: n.species_label ?? n.species! }))
    }, [speciesTree, speciesMeta])

    const cellMap = useMemo(() => {
      const m = new Map<string, ConservationCell>()
      for (const c of cells) m.set(`${c.gene_id}__${c.species}`, c)
      return m
    }, [cells])

    const matrix = useMemo(() => {
      return geneRows.map((g) => speciesCols.map((s) => cellMap.get(`${g.geneId}__${s.species}`)))
    }, [geneRows, speciesCols, cellMap])

    const rowByGene = useMemo(() => {
      const m = new Map<string, number>()
      geneRows.forEach((g, i) => m.set(g.geneId, i))
      return m
    }, [geneRows])

    const gridW = speciesCols.length * cellW
    const gridH = geneRows.length * cellH
    const topH = showSpeciesTree ? TOP_H : SPECIES_LABEL_H
    const fits = containerW > 0 && LEFT_COL_W + gridW + RIGHT_PAD <= containerW
    const selectedRow = selectedGeneId ? (rowByGene.get(selectedGeneId) ?? null) : null
    const selectedCol =
      selectedCell !== null && selectedCell.row === selectedRow ? selectedCell.col : null

    const lineColor = theme.palette.divider
    const absentColor =
      mode === "dark"
        ? alpha(theme.palette.common.white, 0.06)
        : alpha(theme.palette.common.black, 0.05)

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
              const y = SP_LABEL_GAP
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
                  r={4.5}
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
          const v = cell ? (cell[metricDef.field] as number | null) : null
          ctx.fillStyle = cell && cell.orthology_type !== null ? colorFor(v) : absentColor
          ctx.fillRect(c * cellW, r * cellH + 0.5, cellW - 1, cellH - 1)
        }
      }
      ctx.globalAlpha = 1
    }, [
      matrix,
      geneRows,
      metricDef,
      familyFilter,
      selectedRow,
      colorFor,
      lineColor,
      absentColor,
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
        if (row < 0 || row >= geneRows.length || col < 0 || col >= speciesCols.length) return null
        const cell = matrix[row][col]
        const value = cell ? (cell[metricDef.field] as number | null) : null
        const contRect = container.getBoundingClientRect()
        return {
          row,
          col,
          symbol: geneRows[row].symbol,
          name: geneById.get(geneRows[row].geneId)?.name ?? null,
          speciesLabel: speciesCols[col].label,
          value: cell && cell.orthology_type !== null ? value : null,
          cell,
          tipX: e.clientX - contRect.left + container.scrollLeft,
          tipY: e.clientY - contRect.top + container.scrollTop,
        }
      },
      [geneRows, speciesCols, matrix, metricDef, geneById, cellW, cellH],
    )

    const scrollToRow = useCallback(
      (row: number) => {
        const c = containerRef.current
        if (!c) return
        c.scrollTo({ top: topH + row * cellH - c.clientHeight / 2, behavior: "smooth" })
      },
      [cellH, topH],
    )

    const didInitialFocus = useRef(false)
    useEffect(() => {
      if (!selectedGeneId || didInitialFocus.current) return
      if (containerW === 0) return
      const row = rowByGene.get(selectedGeneId)
      if (row === undefined) return
      didInitialFocus.current = true
      scrollToRow(row)
    }, [selectedGeneId, rowByGene, scrollToRow, containerW])

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
        focusGene: (geneId) => {
          const r = rowByGene.get(geneId)
          if (r !== undefined) scrollToRow(r)
        },
        focusFamily: (family) => {
          const rows = geneRows.flatMap((g, i) => (g.family === family ? [i] : []))
          if (rows.length) scrollToRow(rows[Math.floor(rows.length / 2)])
        },
        exportSvg: (filename) => {
          const svg = buildFigureSvg()
          if (svg)
            triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename)
        },
        exportPng: (filename) => {
          const svg = buildFigureSvg()
          if (!svg) return
          const w = LEFT_W + gridW + RIGHT_PAD
          const h = TOP_H + gridH
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
      [rowByGene, geneRows, scrollToRow, gridW, gridH, matrix, metricDef, mode],
    )

    function buildFigureSvg(): string | null {
      if (!geneTree || !speciesTree || gridW === 0) return null
      const w = LEFT_W + gridW + RIGHT_PAD
      const h = TOP_H + gridH
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
      const rects: string[] = []
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          const cell = matrix[r][c]
          const v = cell ? (cell[metricDef.field] as number | null) : null
          const fill = cell && cell.orthology_type !== null ? colorFor(v) : absentColor
          rects.push(
            `<rect x="${LEFT_W + c * cellW}" y="${TOP_H + r * cellH}" width="${cellW - 1}" height="${cellH - 1}" fill="${fill}"/>`,
          )
        }
      }
      const geneLabels = geneRows
        .map((g, i) => {
          const color = getFamilyColor(g.family ?? "?", mode)
          const cy = TOP_H + i * cellH + cellH / 2
          const circle = `<circle cx="${GENE_TREE_W}" cy="${cy}" r="4.5" fill="${color}"/>`
          const text = `<text x="${GENE_TREE_W + GENE_LABEL_GAP}" y="${cy + geneFont * 0.28}" font-size="${geneFont}" font-family="${monoFont}" fill="${color}">${esc(g.symbol)}</text>`
          return circle + text
        })
        .join("")
      const speciesLabels = speciesCols
        .map((s, i) => {
          const x = LEFT_W + i * cellW + cellW / 2
          const y = SPECIES_TREE_H + SP_LABEL_GAP
          return `<text x="${x}" y="${y}" font-size="${speciesFont}" font-family="${monoFont}" fill="${muted}" text-anchor="start" dominant-baseline="central" transform="rotate(90 ${x} ${y})">${esc(s.label)}</text>`
        })
        .join("")
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<rect width="${w}" height="${h}" fill="${theme.palette.background.paper}"/>` +
        `<path transform="translate(0 ${TOP_H})" d="${geneTree.edges}" stroke="${muted}" stroke-width="0.7" fill="none"/>` +
        `<path transform="translate(${LEFT_W} ${SP_TREE_PAD})" d="${speciesTree.edges}" stroke="${muted}" stroke-width="0.7" fill="none"/>` +
        rects.join("") +
        geneLabels +
        speciesLabels +
        `</svg>`
      )
    }

    if (!geneTree || !speciesTree || geneRows.length === 0 || speciesCols.length === 0) {
      return (
        <Box
          sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Typography color="text.secondary">No conservation data to display.</Typography>
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
                minHeight: showSpeciesTree ? undefined : 163,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {cornerSlot}
            </Box>
            {speciesHeader}
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
              {selectedRow !== null && selectedCol !== null && (
                <Box
                  sx={{
                    position: "absolute",
                    left: selectedCol * cellW,
                    top: selectedRow * cellH + 0.5,
                    width: cellW - 1,
                    height: cellH - 1,
                    pointerEvents: "none",
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

        {hover && <HoverTip hover={hover} metricLabel={metricDef.label} monoFont={monoFont} />}
      </Box>
    )
  },
)

export default ConservationHeatmap
