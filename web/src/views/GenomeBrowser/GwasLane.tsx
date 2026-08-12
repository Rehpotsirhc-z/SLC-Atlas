// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Box, Typography, useTheme } from "@mui/material"
import type { GwasPoint, GwasStudy } from "@/types/browser"
import { EDGE_PAD, GWAS_LANE_HEIGHT, LANE_GAP } from "./constants"
import BrowserTooltip, { TipLine, TipTitle } from "./BrowserTooltip"
import { drawGwas, gwasCeiling, gwasNear, type GwasInk } from "./drawGwas"
import { scaleFor, type Scale, type Viewport } from "./scale"
import { useLaneCanvas } from "./useLaneCanvas"
import type { Painter } from "./useBrowserView"

interface Props {
  study: GwasStudy
  points: GwasPoint[]
  covered: boolean
  loading: boolean
  width: number
  gutter: number
  grid: boolean
  showSignificance: boolean
  subscribe: (paint: Painter) => () => void
  liveView: () => Viewport
}

interface Hovered {
  point: GwasPoint
  x: number
  y: number
}

const sameHover = (next: Hovered | null) => (current: Hovered | null) =>
  current?.point === next?.point && current?.x === next?.x ? current : next

function GwasLane({
  study,
  points,
  covered,
  loading,
  width,
  gutter,
  grid,
  showSignificance,
  subscribe,
  liveView,
}: Props) {
  const { palette, custom } = useTheme()
  const [hover, setHover] = useState<Hovered | null>(null)
  const ceilingRef = useRef<HTMLSpanElement>(null)
  const shownMax = useRef(1)

  const ink = useMemo<GwasInk>(
    () => ({
      raised: palette.error.main,
      lowered: palette.primary.main,
      neutral: palette.text.disabled,
      axis: palette.divider,
      grid: palette.action.hover,
      significance: palette.warning.main,
    }),
    [palette],
  )

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, scale: Scale) => {
      const max = gwasCeiling(points, scale.start, scale.end)
      shownMax.current = max
      drawGwas({
        ctx,
        scale,
        height: GWAS_LANE_HEIGHT,
        points,
        max,
        ink,
        grid,
        showSignificance,
      })
      if (ceilingRef.current) ceilingRef.current.textContent = max.toFixed(1)
    },
    [points, ink, grid, showSignificance],
  )

  const canvasRef = useLaneCanvas(subscribe, liveView, width, GWAS_LANE_HEIGHT, paint)

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // A drag is a pan, not an inspection
      if (event.buttons !== 0) return
      const box = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      const found = gwasNear(
        points,
        scaleFor(liveView(), width),
        x,
        y,
        GWAS_LANE_HEIGHT,
        shownMax.current,
      )
      setHover(sameHover(found ? { point: found, x: event.clientX, y: event.clientY } : null))
    },
    [points, liveView, width],
  )

  const clear = useCallback(() => setHover(sameHover(null)), [])

  return (
    <Box sx={{ display: "flex", alignItems: "stretch", mb: `${LANE_GAP}px`, pr: `${EDGE_PAD}px` }}>
      <Box
        sx={{
          width: gutter,
          flexShrink: 0,
          pl: `${EDGE_PAD}px`,
          pr: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Typography noWrap sx={{ fontSize: 13, lineHeight: 1.3 }}>
          {study.trait}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: 11.5, fontFamily: custom.monoFontFamily, color: "text.secondary" }}
        >
          −log₁₀p ≤ <Box component="span" ref={ceilingRef} />
        </Typography>
      </Box>
      <Box
        sx={{ position: "relative", flex: 1, minWidth: 0, height: GWAS_LANE_HEIGHT }}
        onPointerMove={onPointerMove}
        onPointerLeave={clear}
      >
        <canvas ref={canvasRef} style={{ display: "block", width, height: GWAS_LANE_HEIGHT }} />
        {!covered && (
          <Typography
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "text.disabled",
              pointerEvents: "none",
            }}
          >
            {loading ? "loading…" : "this chromosome is not covered by the study"}
          </Typography>
        )}
      </Box>
      {hover && (
        <BrowserTooltip x={hover.x} y={hover.y}>
          <TipTitle>{hover.point.snp_id || "unnamed variant"}</TipTitle>
          <TipLine>{`${hover.point.position.toLocaleString()} · ${study.trait}`}</TipLine>
          <TipLine>
            {hover.point.p_value === null || hover.point.p_value === 0
              ? "p below the smallest value a double can hold"
              : `p = ${hover.point.p_value.toExponential(2)}`}
          </TipLine>
          {hover.point.beta !== null && (
            <TipLine>
              {`\u03b2 = ${hover.point.beta.toFixed(4)} (${
                hover.point.beta > 0 ? "raises" : "lowers"
              } the trait)`}
            </TipLine>
          )}
        </BrowserTooltip>
      )}
    </Box>
  )
}

export default memo(GwasLane)
