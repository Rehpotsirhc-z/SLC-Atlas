// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
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
import TranscriptSummary from "./TranscriptSummary"
import {
  buildTranscriptStats,
  buildTypeCounts,
  sortTranscripts,
  type TranscriptSortKey,
} from "./transcriptStats"
import type { SortDir } from "@/types/table"

const SKELETON_ROWS = 3

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
}

export default function TranscriptTable({ geneId, chromosome }: Props) {
  const { data: transcripts, isLoading } = useTranscripts(geneId)
  const { custom } = useTheme()
  const [sortKey, setSortKey] = useState<TranscriptSortKey>("start")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

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

  const monoSx = { fontFamily: custom.monoFontFamily, fontSize: custom.monoFontSize }

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
            {COLUMNS.map(({ key, label, align }) => (
              <TableCell key={key} align={align}>
                <TableSortLabel
                  active={sortKey === key}
                  direction={sortKey === key ? sortDir : "asc"}
                  onClick={() => handleSort(key)}
                >
                  {label}
                </TableSortLabel>
              </TableCell>
            ))}
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
                  <TableCell sx={monoSx}>{t.id}</TableCell>
                  <TableCell sx={monoSx}>{t.name}</TableCell>
                  <TableCell sx={monoSx}>{t.type}</TableCell>
                  <TableCell sx={monoSx}>{formatPosition(chromosome, t.start, t.end)}</TableCell>
                  <TableCell align="right" sx={monoSx}>
                    {t.length.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!isLoading && stats && (
        <TranscriptSummary sorted={sorted} typeCounts={typeCounts} stats={stats} />
      )}
    </Box>
  )
}
