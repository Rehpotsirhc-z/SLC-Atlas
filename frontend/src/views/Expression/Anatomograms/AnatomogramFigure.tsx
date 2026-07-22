// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import { Box, Typography, useMediaQuery } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"
import { displayTissue } from "@/utils/tissue"
import { SVG_FOR } from "./svgAssets"
import { tissueAt } from "./svgDom"
import type { RailView } from "./tissueMaps"
import { useAnatomogramColors } from "./useAnatomogramColors"
import { useAnatomogramSvg } from "./useAnatomogramSvg"

export interface AnatomogramFigureProps {
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  tpmByTissue: Map<string, number> | null
  domainMax: number
  onPick: (tissues: string[]) => void
  // "width" fills the container (docked rail), "contain" fits a fixed box (floating window)
  fit?: "width" | "contain"
}

export default function AnatomogramFigure({
  view,
  presentTissues,
  selectedTissue,
  tpmByTissue,
  domainMax,
  onPick,
  fit = "width",
}: AnatomogramFigureProps) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [hover, setHover] = useState<{ tissue: string; cx: number; cy: number } | null>(null)
  const { colors, intensityFill } = useAnatomogramColors(domainMax)

  const { wrapRef, partsRef } = useAnatomogramSvg({
    svg: SVG_FOR[view],
    view,
    presentTissues,
    selectedTissue,
    tpmByTissue,
    colors,
    intensityFill,
    reduceMotion,
    fit,
    hoverTissue: hover?.tissue ?? null,
  })

  const contain = fit === "contain"
  const tissuesOf = (tissue: string) => partsRef.current.get(tissue)?.tissues ?? [tissue]

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        ...(contain && { height: "100%", minHeight: 0, alignItems: "center" }),
      }}
    >
      <Box
        ref={wrapRef}
        sx={
          contain
            ? {
                width: "100%",
                height: "100%",
                minHeight: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }
            : { width: "100%" }
        }
        onMouseMove={(e) => {
          if (!wrapRef.current) return
          const tissue = tissueAt(wrapRef.current, e.clientX, e.clientY)
          if (tissue) setHover({ tissue, cx: e.clientX, cy: e.clientY })
          else if (hover) setHover(null)
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          if (!wrapRef.current) return
          const tissue = tissueAt(wrapRef.current, e.clientX, e.clientY)
          if (!tissue) return
          const tissues = tissuesOf(tissue).filter((t) => presentTissues.has(t))
          if (tissues.length) onPick(tissues)
        }}
      />
      {hover && (
        <HoverTooltip x={hover.cx} y={hover.cy} maxWidth={220} sx={{ py: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            {tissuesOf(hover.tissue).map(displayTissue).join(", ")}
          </Typography>
        </HoverTooltip>
      )}
    </Box>
  )
}
