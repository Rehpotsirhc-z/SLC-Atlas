// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState } from "react"
import {
  Box,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  type PaletteOptions,
} from "@mui/material"
import { useTranscripts } from "@/api/hooks/useGenes"
import { formatPosition } from "@/utils/format"
import type { Transcript } from "@/types/gene"

const ROW_H = 22
const BAR_H = 10
const LABEL_W = 95
const TICK_AREA_H = 20

const TYPE_COLORS: Record<string, string> = {
  protein_coding: "#51afef",
  retained_intron: "#c678dd",
  processed_transcript: "#98be65",
  nonsense_mediated_decay: "#ff6c6b",
  lncRNA: "#4db5bd",
  processed_pseudogene: "#ECBE7B",
}
const FALLBACK_COLOR = "#73797e"

function TranscriptMapDiagram({
  transcripts,
  palette,
  monoFont,
}: {
  transcripts: Transcript[]
  palette: PaletteOptions
  monoFont: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const minStart = Math.min(...transcripts.map((t) => t.start))
  const maxEnd = Math.max(...transcripts.map((t) => t.end))
  const span = maxEnd - minStart || 1
  const trackW = Math.max(0, width - LABEL_W)
  const barsH = transcripts.length * ROW_H
  const svgH = barsH + TICK_AREA_H

  const isDark = (palette as { mode?: string }).mode === "dark"
  const textColor = isDark ? "#9ca0a4" : "#5B6268"
  const gridColor = isDark ? "#3f444a" : "#c6c7c7"

  const toX = (pos: number) => LABEL_W + ((pos - minStart) / span) * trackW

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    x: LABEL_W + f * trackW,
    label: `${((minStart + f * span) / 1_000_000).toFixed(2)} Mb`,
    f,
  }))

  return (
    <Box>
      <Typography
        variant="overline"
        color="primary"
        sx={{ lineHeight: 1, mb: 1, display: "block" }}
      >
        Transcript Map
      </Typography>
      <Box ref={containerRef} sx={{ width: "100%" }}>
        {width > 0 && (
          <svg width={width} height={svgH} style={{ display: "block" }}>
            {ticks.map(({ x, f }) => (
              <line
                key={f}
                x1={x}
                y1={0}
                x2={x}
                y2={barsH}
                stroke={gridColor}
                strokeWidth={1}
                strokeDasharray={f === 0 || f === 1 ? undefined : "4 4"}
              />
            ))}
            {transcripts.map((t, i) => {
              const barColor = TYPE_COLORS[t.type] ?? FALLBACK_COLOR
              const x1 = toX(t.start)
              const x2 = toX(t.end)
              const midY = i * ROW_H + ROW_H / 2
              return (
                <g key={t.id}>
                  <text
                    x={0}
                    y={midY + 4}
                    textAnchor="start"
                    fontSize={10}
                    fontFamily={monoFont}
                    fill={textColor}
                  >
                    {t.name || t.id}
                  </text>
                  <line
                    x1={x1}
                    y1={midY}
                    x2={x2}
                    y2={midY}
                    stroke={barColor}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                  <rect
                    x={x1}
                    y={midY - BAR_H / 2}
                    width={Math.max(1, x2 - x1)}
                    height={BAR_H}
                    rx={2}
                    fill={barColor}
                    fillOpacity={0.75}
                  />
                </g>
              )
            })}
            {ticks.map(({ x, label, f }) => (
              <text
                key={f}
                x={x}
                y={barsH + 14}
                textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                fontSize={9}
                fontFamily={monoFont}
                fill={textColor}
              >
                {label}
              </text>
            ))}
          </svg>
        )}
      </Box>
    </Box>
  )
}

interface TranscriptTableProps {
  geneId: string
  chromosome: string
}

const SKELETON_ROWS = 3

export default function TranscriptTable({ geneId, chromosome }: TranscriptTableProps) {
  const { data: transcripts, isLoading } = useTranscripts(geneId)
  const { custom, palette } = useTheme()

  const typeCounts = transcripts
    ? [
        ...transcripts
          .reduce((map, t) => {
            map.set(t.type, (map.get(t.type) ?? 0) + 1)
            return map
          }, new Map<string, number>())
          .entries(),
      ].sort((a, b) => b[1] - a[1])
    : []

  const stats =
    transcripts && transcripts.length > 0
      ? (() => {
          const lengths = transcripts.map((t) => t.length)
          const longest = transcripts.reduce((a, b) => (a.length >= b.length ? a : b))
          const span =
            Math.max(...transcripts.map((t) => t.end)) -
            Math.min(...transcripts.map((t) => t.start))
          return {
            total: transcripts.length,
            span,
            minLength: Math.min(...lengths),
            maxLength: Math.max(...lengths),
            longestId: longest.id,
            longestName: longest.name,
          }
        })()
      : null

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "background.default",
        display: "flex",
        gap: 4,
        alignItems: "flex-start",
      }}
    >
      <Table size="small" sx={{ width: "auto" }}>
        <TableHead>
          <TableRow>
            <TableCell>Transcript ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Position</TableCell>
            <TableCell align="right">Length</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }).map((_, row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Skeleton variant="text" width="80%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="60%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="50%" />
                  </TableCell>
                  <TableCell>
                    <Skeleton variant="text" width="70%" />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="text" width="40%" sx={{ ml: "auto" }} />
                  </TableCell>
                </TableRow>
              ))
            : (transcripts ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell sx={{ fontFamily: custom.monoFontFamily }}>{t.id}</TableCell>
                  <TableCell sx={{ fontFamily: custom.monoFontFamily }}>{t.name}</TableCell>
                  <TableCell sx={{ fontFamily: custom.monoFontFamily }}>{t.type}</TableCell>
                  <TableCell sx={{ fontFamily: custom.monoFontFamily }}>
                    {formatPosition(chromosome, t.start, t.end)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: custom.monoFontFamily }}>
                    {t.length.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!isLoading && stats && transcripts && (
        <Box
          sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}
        >
          <Box sx={{ display: "flex", gap: 4 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Typography variant="overline" color="primary" sx={{ lineHeight: 1, mb: 0.5 }}>
                Biotypes
              </Typography>
              {typeCounts.map(([type, count]) => (
                <Box key={type} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    label={count}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.7rem",
                      minWidth: 24,
                      bgcolor: "action.selected",
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {type.replace(/_/g, " ")}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Typography variant="overline" color="primary" sx={{ lineHeight: 1, mb: 0.5 }}>
                Stats
              </Typography>
              {(
                [
                  ["Total", `${stats.total} transcript${stats.total !== 1 ? "s" : ""}`],
                  ["Genomic span", `${(stats.span / 1000).toFixed(1)} kb`],
                  [
                    "Length range",
                    `${stats.minLength.toLocaleString()}–${stats.maxLength.toLocaleString()} bp`,
                  ],
                  ["Longest", stats.longestName || stats.longestId],
                ] as [string, string][]
              ).map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>
                    {label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: custom.monoFontFamily }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <TranscriptMapDiagram
            transcripts={transcripts}
            palette={palette}
            monoFont={custom.monoFontFamily}
          />
        </Box>
      )}
    </Box>
  )
}
