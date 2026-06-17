// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  useTheme,
} from "@mui/material"
import { useTranscripts } from "@/api/hooks/useGenes"
import { formatPosition } from "@/utils/format"

interface TranscriptTableProps {
  geneId: string
  chromosome: string
}

const SKELETON_ROWS = 3

export default function TranscriptTable({ geneId, chromosome }: TranscriptTableProps) {
  const { data: transcripts, isLoading } = useTranscripts(geneId)
  const { custom, palette } = useTheme()

  return (
    <Box sx={{ p: 2, bgcolor: "background.default" }}>
      <Table size="small">
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
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.type}</TableCell>
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
    </Box>
  )
}
