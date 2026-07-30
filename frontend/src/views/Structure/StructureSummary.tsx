// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Paper, Stack, Typography } from "@mui/material"
import type { StructureRecord } from "@/types/structure"

interface Props {
  structures: StructureRecord[]
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: "1 1 160px", minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} color="primary">
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  )
}

export default function StructureSummary({ structures }: Props) {
  const solved = structures.filter((s) => s.n_experimental > 0).length
  const modelled = structures.filter((s) => s.afdb_entry_id).length
  const confident = structures.filter((s) => (s.mean_plddt ?? 0) >= 70).length
  const helices = structures.reduce((sum, s) => sum + s.n_transmembrane, 0)

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Select a gene to see its membrane topology, predicted model, and experimental structures.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        <Metric value={modelled} label="genes with a predicted model" />
        <Metric value={solved} label="genes with an experimental structure" />
        <Metric value={confident} label="models at mean pLDDT ≥ 70" />
        <Metric value={helices} label="annotated transmembrane helices" />
      </Box>

      <Typography variant="caption" color="text.secondary">
        Every gene has a predicted model; roughly a third have been solved experimentally. A gene
        with no experimental structure is a gap in the literature, not a gap in this atlas.
      </Typography>
    </Stack>
  )
}
