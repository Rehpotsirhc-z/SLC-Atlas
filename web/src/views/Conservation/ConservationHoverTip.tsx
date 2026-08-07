// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from "@mui/material"
import CellHoverTip from "@/components/heatmap/CellHoverTip"
import type { ConservationHoverState } from "./useConservationMatrix"

interface ConservationHoverTipProps {
  hover: ConservationHoverState
  metricLabel: string
  monoFont: string
}

export default function ConservationHoverTip({
  hover,
  metricLabel,
  monoFont,
}: ConservationHoverTipProps) {
  return (
    <CellHoverTip
      x={hover.clientX}
      y={hover.clientY}
      symbol={hover.symbol}
      columnLabel={hover.speciesLabel}
      name={hover.name}
      monoFont={monoFont}
    >
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
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.25, fontSize: 13 }}
        >
          No ortholog
        </Typography>
      )}
    </CellHoverTip>
  )
}
