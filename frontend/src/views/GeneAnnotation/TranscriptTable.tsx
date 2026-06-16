// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material"
import { useTranscripts } from "@/api/hooks/useGenes"
import { formatPosition } from "@/utils/format"

interface TranscriptTableProps {
  geneId: string
  chromosome: string
}

export default function TranscriptTable({ geneId, chromosome }: TranscriptTableProps) {
  const { data: transcripts, isLoading } = useTranscripts(geneId)

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <CircularProgress size={16} />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2, bgcolor: "action.hover" }}>
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
          {(transcripts ?? []).map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.id}</TableCell>
              <TableCell>{t.name}</TableCell>
              <TableCell>{t.type}</TableCell>
              <TableCell>{formatPosition(chromosome, t.start, t.end)}</TableCell>
              <TableCell align="right">{t.length.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )
}
