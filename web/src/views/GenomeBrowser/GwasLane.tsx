// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef } from "react"
import { Box, useTheme } from "@mui/material"
import { variantName, type VariantBlock } from "@/api/bbi"
import type { GwasStudy } from "@/types/browser"
import { EDGE_PAD, GWAS_LANE_HEIGHT, GWAS_LANE_KEY, LANE_GAP } from "./constants"
import BrowserTooltip, { TipLine, TipTitle } from "./BrowserTooltip"
import LaneAxis, { type AxisHandle } from "./LaneAxis"
import LaneFrame from "./LaneFrame"
import LaneGutter from "./LaneGutter"
import {
  drawGwas,
  GWAS_PLOT_TOP,
  gwasCeiling,
  gwasNear,
  SIGNIFICANCE_Y,
  type GwasInk,
} from "./drawGwas"
import { formatPoint, frameScale, type Scale, type Viewport } from "./scale"
import { useHoverFrame } from "./useHoverFrame"
import { useLaneCanvas } from "./useLaneCanvas"
import type { LaneVisibility, LaneWatch } from "./useLaneVisibility"
import type { Painter } from "./useBrowserView"

interface Props {
  study: GwasStudy
  block: VariantBlock
  chrom: string
  covered: boolean
  partial: boolean
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
  at: number
  snp: string | null
  position: number
  value: number
  beta: number
  x: number
  y: number
}

const sameHover = (a: Hovered | null, b: Hovered | null) => a?.at === b?.at

function GwasLane({
  study,
  block,
  chrom,
  covered,
  partial,
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
      if (!moving() || shownMax.current === 0) {
        shownMax.current = gwasCeiling(block, scale.start, scale.end)
      }
      const max = shownMax.current
      drawGwas({
        ctx,
        scale,
        height: GWAS_LANE_HEIGHT,
        block,
        max,
        ink,
        grid,
        showSignificance,
      })
      axisRef.current?.draw(
        max,
        false,
        GWAS_LANE_HEIGHT - GWAS_PLOT_TOP,
        showSignificance && SIGNIFICANCE_Y <= max ? [SIGNIFICANCE_Y] : [],
      )
    },
    [block, ink, grid, showSignificance, moving],
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
      const at = gwasNear(
        block,
        frameScale(liveView(), width),
        clientX - box.left,
        clientY - box.top,
        GWAS_LANE_HEIGHT,
        shownMax.current,
      )
      if (at < 0) return null
      return {
        at,
        snp: variantName(block, at),
        position: block.positions[at],
        value: block.values[at],
        beta: block.betas[at],
        x: clientX,
        y: clientY,
      }
    },
    [block, liveView, width],
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
        details={<>{partial && <Box>Not all variants shown</Box>}</>}
      >
        −log10(p)
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
          <TipTitle>{hover.snp || "unnamed variant"}</TipTitle>
          <TipLine>{study.trait}</TipLine>
          <TipLine>{formatPoint(chrom, hover.position)}</TipLine>
          <TipLine>
            {Number.isNaN(hover.value)
              ? "p is smaller than the browser can represent"
              : `p = ${(10 ** -hover.value).toExponential(2)}`}
          </TipLine>
          {!Number.isNaN(hover.value) && (
            <TipLine>{`−log10(p) = ${hover.value.toFixed(2)}`}</TipLine>
          )}
          {!Number.isNaN(hover.beta) && (
            <TipLine>
              {`\u03b2 = ${hover.beta.toFixed(4)} (${hover.beta > 0 ? "raises" : "lowers"} the trait)`}
            </TipLine>
          )}
        </BrowserTooltip>
      )}
    </Box>
  )
}

export default memo(GwasLane)
