// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import { Box, Typography } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"

interface CellHoverTipProps {
  x: number
  y: number
  symbol: string
  columnLabel: string
  name: string | null
  monoFont: string
  children: ReactNode
}

export default function CellHoverTip({
  x,
  y,
  symbol,
  columnLabel,
  name,
  monoFont,
  children,
}: CellHoverTipProps) {
  return (
    <HoverTooltip x={x} y={y}>
      <Typography
        variant="caption"
        sx={{ fontFamily: monoFont, display: "block", fontWeight: 600, fontSize: 13 }}
      >
        {symbol}
        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
          {"  ×  "}
        </Box>
        {columnLabel}
      </Typography>
      {name && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "justify", fontSize: 13 }}
        >
          {name}
        </Typography>
      )}
      {children}
    </HoverTooltip>
  )
}
