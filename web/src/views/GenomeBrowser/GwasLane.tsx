// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef } from "react"
import { Box, Typography, useTheme } from "@mui/material"
import type { GwasPoint, GwasStudy } from "@/types/browser"
import { EDGE_PAD, GWAS_LANE_HEIGHT, GWAS_OVERVIEW_BIN, LANE_GAP } from "./constants"
import BrowserTooltip, { TipLine, TipTitle } from "./BrowserTooltip"
import { drawGwas, gwasCeiling, gwasNear, type GwasInk } from "./drawGwas"
import { frameScale, type Scale, type Viewport } from "./scale"
import { useHoverFrame } from "./useHoverFrame"
import { useLaneCanvas } from "./useLaneCanvas"
import type { LaneWatch } from "./useLaneVisibility"
import type { Painter } from "./useBrowserView"

interface Props {
  study: GwasStudy
  points: GwasPoint[]
  covered: boolean
  /** The view is too wide for every variant, so what is drawn is the overview */
  thinned: boolean
  loading: boolean
  width: number
  gutter: number
  grid: boolean
  showSignificance: boolean
  subscribe: (paint: Painter) => () => void
  liveView: () => Viewport
  moving: () => boolean
  watch?: LaneWatch
}

interface Hovered {
  point: GwasPoint
  x: number
  y: number
}

// The variant is what the tooltip shows, so moving between pixels over the same one is nothing
const sameHover = (a: Hovered | null, b: Hovered | null) => a?.point === b?.point

function GwasLane({
  study,
  points,
  covered,
  thinned,
  loading,
  width,
  gutter,
  grid,
  showSignificance,
  subscribe,
  liveView,
  moving,
  watch,
}: Props) {
  const { palette, custom } = useTheme()
  const plotRef = useRef<HTMLDivElement>(null)
  const ceilingRef = useRef<HTMLSpanElement>(null)
  const shownMax = useRef(0)
  const shownText = useRef("")

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
      // The axis is worked out where the view has settled and held through the gesture: a
      // ceiling recomputed every frame slides every variant up and down under the drag, and it
      // is a scan of the window on top of the one that draws it
      if (!moving() || shownMax.current === 0) {
        shownMax.current = gwasCeiling(points, scale.start, scale.end)
      }
      const max = shownMax.current
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
      const text = max.toFixed(1)
      if (ceilingRef.current && shownText.current !== text) {
        ceilingRef.current.textContent = text
        shownText.current = text
      }
    },
    [points, ink, grid, showSignificance, moving],
  )

  const canvasRef = useLaneCanvas(subscribe, liveView, width, GWAS_LANE_HEIGHT, paint, watch)

  const read = useCallback(
    (clientX: number, clientY: number): Hovered | null => {
      const box = plotRef.current?.getBoundingClientRect()
      if (!box) return null
      const found = gwasNear(
        points,
        frameScale(liveView(), width),
        clientX - box.left,
        clientY - box.top,
        GWAS_LANE_HEIGHT,
        shownMax.current,
      )
      return found ? { point: found, x: clientX, y: clientY } : null
    },
    [points, liveView, width],
  )

  const { hovered: hover, onMove, clear } = useHoverFrame(read, sameHover)

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // A drag is a pan, not an inspection
      if (event.buttons !== 0) return
      onMove(event.clientX, event.clientY)
    },
    [onMove],
  )

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
        {thinned && (
          <Typography
            component="span"
            sx={{ fontSize: 11, color: "text.disabled", lineHeight: 1.2 }}
          >
            {`summary: significant + strongest per ${GWAS_OVERVIEW_BIN / 1000} kb`}
          </Typography>
        )}
      </Box>
      <Box
        ref={plotRef}
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
