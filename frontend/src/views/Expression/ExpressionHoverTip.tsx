// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from "@mui/material"
import CellHoverTip from "@/components/heatmap/CellHoverTip"
import { formatTpm } from "@/utils/format"
import type { ExpressionHoverState } from "./useExpressionHeatmapState"

interface ExpressionHoverTipProps {
  hover: ExpressionHoverState
  monoFont: string
}

export default function ExpressionHoverTip({ hover, monoFont }: ExpressionHoverTipProps) {
  return (
    <CellHoverTip
      x={hover.clientX}
      y={hover.clientY}
      symbol={hover.symbol}
      columnLabel={hover.tissue}
      name={hover.name}
      monoFont={monoFont}
    >
      <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontSize: 13 }}>
        TPM:{" "}
        <Box component="span" sx={{ fontFamily: monoFont, fontWeight: 600 }}>
          {hover.value !== null ? formatTpm(hover.value) : "—"}
        </Box>
      </Typography>
    </CellHoverTip>
  )
}
