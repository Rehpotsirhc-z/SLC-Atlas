// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Stack, Tooltip, Typography } from "@mui/material"
import { PLDDT_BANDS, type StructureRecord } from "@/types/structure"

interface Props {
  structure: StructureRecord
}

export default function PlddtBar({ structure }: Props) {
  const bands = PLDDT_BANDS.map((band) => ({
    ...band,
    fraction: (structure[band.key] as number | null) ?? 0,
  })).filter((band) => band.fraction > 0)

  if (bands.length === 0) return null

  return (
    <Stack spacing={0.5}>
      <Box sx={{ display: "flex", height: 10, borderRadius: 1, overflow: "hidden" }}>
        {bands.map((band) => (
          <Tooltip
            key={band.key}
            title={`${band.label}: ${(band.fraction * 100).toFixed(0)}% of residues`}
          >
            <Box sx={{ flexGrow: band.fraction, bgcolor: band.color }} />
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary">
        Prediction confidence (pLDDT) across {structure.uniprot_length ?? "?"} residues
      </Typography>
    </Stack>
  )
}
