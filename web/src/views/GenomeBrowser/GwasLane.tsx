// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef } from "react"
import { Box, useTheme } from "@mui/material"
import type { GwasPoint, GwasStudy } from "@/types/browser"
import { EDGE_PAD, GWAS_LANE_HEIGHT, GWAS_LANE_KEY, GWAS_OVERVIEW_BIN, LANE_GAP } from "./constants"
import BrowserTooltip, { TipLine, TipTitle } from "./BrowserTooltip"
import LaneAxis, { type AxisHandle } from "./LaneAxis"
import LaneFrame from "./LaneFrame"
import LaneGutter from "./LaneGutter"
import { drawGwas, GWAS_PLOT_TOP, gwasCeiling, gwasNear, type GwasInk } from "./drawGwas"
import { formatPoint, frameScale, type Scale, type Viewport } from "./scale"
import { useHoverFrame } from "./useHoverFrame"
import { useLaneCanvas } from "./useLaneCanvas"
import type { LaneVisibility, LaneWatch } from "./useLaneVisibility"
import type { Painter } from "./useBrowserView"

interface Props {
  study: GwasStudy
  points: GwasPoint[]
  chrom: string
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
  watch?: LaneVisibility["watch"]
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
  chrom,
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
  const axisRef = useRef<AxisHandle | null>(null)
  const shownMax = useRef(0)

  const ink = useMemo<GwasInk>(
    () => ({
      raised: palette.error.main,
      lowered: palette.primary.main,
      neutral: palette.text.disabled,
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
      axisRef.current?.draw(max, false, GWAS_LANE_HEIGHT - GWAS_PLOT_TOP)
    },
    [points, ink, grid, showSignificance, moving],
  )

  const watchThis = useMemo<LaneWatch | undefined>(
    () => (watch ? (el, onVisible) => watch(el, GWAS_LANE_KEY, onVisible) : undefined),
    [watch],
  )

  const canvasRef = useLaneCanvas(subscribe, liveView, width, GWAS_LANE_HEIGHT, paint, watchThis)

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
      <LaneGutter
        gutter={gutter}
        height={GWAS_LANE_HEIGHT}
        name={study.trait}
        group="GWAS"
        title={
          thinned
            ? `${study.trait}. Summary: significant variants and the strongest per ${GWAS_OVERVIEW_BIN / 1000} kb`
            : study.trait
        }
      >
        −log10(p){thinned ? " · summary" : ""}
      </LaneGutter>
      <LaneAxis height={GWAS_LANE_HEIGHT} handleRef={axisRef} />
      <Box
        ref={plotRef}
        sx={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height: GWAS_LANE_HEIGHT,
          bgcolor: custom.plotSurface,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={clear}
      >
        <canvas ref={canvasRef} style={{ display: "block", width, height: GWAS_LANE_HEIGHT }} />
        <LaneFrame />
        {!covered && (
          <Box
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
            {loading ? "Loading…" : "No study data for this chromosome"}
          </Box>
        )}
      </Box>
      {hover && (
        <BrowserTooltip x={hover.x} y={hover.y}>
          <TipTitle>{hover.point.snp_id || "unnamed variant"}</TipTitle>
          <TipLine>{study.trait}</TipLine>
          <TipLine>{formatPoint(chrom, hover.point.position)}</TipLine>
          <TipLine>
            {hover.point.p_value === null || hover.point.p_value === 0
              ? "p is smaller than the browser can represent"
              : `p = ${hover.point.p_value.toExponential(2)}`}
          </TipLine>
          {hover.point.neg_log10_p !== null && (
            <TipLine>{`−log10(p) = ${hover.point.neg_log10_p.toFixed(2)}`}</TipLine>
          )}
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
