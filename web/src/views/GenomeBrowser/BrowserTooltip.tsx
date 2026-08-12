// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Render shared browser tooltips */

import type { ReactNode } from "react"
import { Typography, useTheme } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"

export function TipTitle({ children }: { children: ReactNode }) {
  const { custom } = useTheme()
  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: custom.monoFontFamily, display: "block", fontWeight: 600, fontSize: 13 }}
    >
      {children}
    </Typography>
  )
}

export function TipLine({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontSize: 13 }}>
      {children}
    </Typography>
  )
}

interface Props {
  x: number
  y: number
  children: ReactNode
}

export default function BrowserTooltip({ x, y, children }: Props) {
  return (
    <HoverTooltip x={x} y={y}>
      {children}
    </HoverTooltip>
  )
}

/** Strand spelled out, because a bare + or - after a middle dot reads as punctuation. */
export const strandLabel = (strand: string) =>
  strand === "-" ? "reverse strand" : strand === "+" ? "forward strand" : "strand unknown"
