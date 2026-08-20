// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  useTheme,
} from "@mui/material"
import { useTranscripts } from "@/api/hooks/useGenes"
import { formatPosition } from "@/utils/format"
import { MAP_COLUMN_MIN_WIDTH } from "./constants"
import { MapAxisHeader, MapBarCell } from "./TranscriptMapColumn"
import TranscriptMapDiagram from "./TranscriptMapDiagram"
import TranscriptStatsHeader from "./TranscriptStatsHeader"
import { buildTranscriptScale } from "./transcriptMap"
import {
  buildTranscriptStats,
  buildTypeCounts,
  sortTranscripts,
  type TranscriptSortKey,
} from "./transcriptStats"
import type { SortDir } from "@/types/table"

const SKELETON_ROWS = 3
const CONTENT_PAD_X = 16

const COLUMNS: {
  key: TranscriptSortKey
  label: string
  align: "left" | "right"
  skeletonWidth: string
}[] = [
  { key: "id", label: "Transcript ID", align: "left", skeletonWidth: "80%" },
  { key: "name", label: "Name", align: "left", skeletonWidth: "60%" },
  { key: "type", label: "Type", align: "left", skeletonWidth: "50%" },
  { key: "start", label: "Position", align: "left", skeletonWidth: "70%" },
  { key: "length", label: "Length", align: "right", skeletonWidth: "40%" },
]

interface Props {
  geneId: string
  chromosome: string
  availableWidth: number
}

export default function TranscriptTable({ geneId, chromosome, availableWidth }: Props) {
  const { data: transcripts, isLoading } = useTranscripts(geneId)
  const { custom } = useTheme()
  const [sortKey, setSortKey] = useState<TranscriptSortKey>("start")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const headRef = useRef<HTMLTableSectionElement>(null)
  const [colsWidth, setColsWidth] = useState(0)

  function handleSort(key: TranscriptSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = useMemo(
    () => (transcripts ? sortTranscripts(transcripts, sortKey, sortDir) : []),
    [transcripts, sortKey, sortDir],
  )
  const typeCounts = useMemo(() => buildTypeCounts(transcripts ?? []), [transcripts])
  const stats = useMemo(() => buildTranscriptStats(transcripts ?? []), [transcripts])
  const scale = useMemo(() => (sorted.length ? buildTranscriptScale(sorted) : null), [sorted])

  // Natural width of the data columns
  useLayoutEffect(() => {
    const head = headRef.current
    if (!head || !sorted.length) return
    const cells = Array.from(head.querySelectorAll("th")).slice(0, COLUMNS.length)
    const w = cells.reduce((sum, c) => sum + c.offsetWidth, 0)
    if (w) setColsWidth(w)
  }, [sorted])

  const contentWidth = availableWidth > 0 ? availableWidth - CONTENT_PAD_X * 2 : 0
  const inlineMap = colsWidth > 0 && contentWidth >= colsWidth + MAP_COLUMN_MIN_WIDTH

  const monoSx = { fontFamily: custom.monoFontFamily, fontSize: custom.monoFontSize }

  return (
    <Box sx={{ p: 2, bgcolor: "background.default" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          maxWidth: contentWidth ? `${contentWidth}px` : undefined,
        }}
      >
        {!isLoading && stats && <TranscriptStatsHeader typeCounts={typeCounts} stats={stats} />}

        <Table size="small" sx={{ width: inlineMap ? "100%" : "auto", alignSelf: "flex-start" }}>
          <TableHead ref={headRef}>
            <TableRow>
              {COLUMNS.map(({ key, label, align }) => (
                <TableCell key={key} align={align} sx={{ whiteSpace: "nowrap" }}>
                  <TableSortLabel
                    active={sortKey === key}
                    direction={sortKey === key ? sortDir : "asc"}
                    onClick={() => handleSort(key)}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              ))}
              {inlineMap && scale && <MapAxisHeader scale={scale} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }).map((_, row) => (
                  <TableRow key={row}>
                    {COLUMNS.map(({ key, align, skeletonWidth }) => (
                      <TableCell key={key} align={align}>
                        <Skeleton
                          variant="text"
                          width={skeletonWidth}
                          sx={align === "right" ? { ml: "auto" } : undefined}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : sorted.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell sx={{ ...monoSx, whiteSpace: "nowrap" }}>{t.id}</TableCell>
                    <TableCell sx={{ ...monoSx, whiteSpace: "nowrap" }}>{t.name}</TableCell>
                    <TableCell sx={monoSx}>{t.type}</TableCell>
                    <TableCell sx={{ ...monoSx, whiteSpace: "nowrap" }}>
                      {formatPosition(chromosome, t.start, t.end)}
                    </TableCell>
                    <TableCell align="right" sx={{ ...monoSx, whiteSpace: "nowrap" }}>
                      {t.length.toLocaleString()}
                    </TableCell>
                    {inlineMap && scale && <MapBarCell transcript={t} scale={scale} />}
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {!inlineMap && !isLoading && scale && <TranscriptMapDiagram transcripts={sorted} />}
      </Box>
    </Box>
  )
}
