// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"
import type { Gene } from "@/types/gene"
import type { LeafLayout } from "./phyloLayout"

interface Props {
  leaf: LeafLayout
  gene: Gene | undefined
  x: number
  y: number
  monoFont: string
}

export default function PhyloTooltip({ leaf, gene, x, y, monoFont }: Props) {
  return (
    <HoverTooltip x={x} y={y}>
      <Typography
        variant="caption"
        sx={{ fontFamily: monoFont, display: "block", fontWeight: 600, fontSize: 13 }}
      >
        {leaf.symbol}
      </Typography>
      {gene?.name && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "justify" }}>
          {gene.name}
        </Typography>
      )}
      <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontSize: 13 }}>
        <Box component="span" sx={{ fontFamily: monoFont, fontWeight: 600 }}>
          {leaf.family}
        </Box>
        {gene?.category && (
          <Box component="span" sx={{ color: "text.secondary" }}>
            <Box
              component="span"
              sx={{ mx: 0.25, fontWeight: 700, fontSize: 15, verticalAlign: "middle" }}
            >
              {" · "}
            </Box>
            {gene.category}
          </Box>
        )}
      </Typography>
    </HoverTooltip>
  )
}
