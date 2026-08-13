// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef } from "react"
import { Box, Tooltip, Typography, useTheme } from "@mui/material"
import type { CoverageTrack } from "@/types/browser"
import { EDGE_PAD, LANE_GAP, Y_HEADROOM } from "./constants"
import { columnPeaks, drawCoverage, valueAt, type CoverageInk } from "./drawCoverage"
import BrowserTooltip, { TipLine, TipTitle } from "./BrowserTooltip"
import { frameScale } from "./scale"
import type { LaneData } from "./useCoverageData"
import { useLaneCanvas } from "./useLaneCanvas"
import { useHoverFrame } from "./useHoverFrame"
import type { LaneVisibility, LaneWatch } from "./useLaneVisibility"
import type { Painter } from "./useBrowserView"
import type { Viewport } from "./scale"

interface Props {
  track: CoverageTrack
  data: LaneData
  color: string
  height: number
  width: number
  gutter: number
  grid: boolean
  yMax: number | null
  subscribe: (paint: Painter) => () => void
  liveView: () => Viewport
  moving: () => boolean
  watch?: LaneVisibility["watch"]
}

interface Hovered {
  base: number
  plus: number | null
  minus: number | null
  x: number
  y: number
}

// Compared on what the tooltip says rather than on where the pointer is, so travelling along a
// stretch the track reads the same across costs no renders at all
const sameHover = (a: Hovered | null, b: Hovered | null) =>
  a?.base === b?.base && a?.plus === b?.plus && a?.minus === b?.minus

function formatSignal(value: number): string {
  if (value >= 1000) return value.toExponential(1)
  if (value >= 10) return value.toFixed(0)
  if (value >= 1) return value.toFixed(1)
  return value.toFixed(2)
}

function TrackLane({
  track,
  data,
  color,
  height,
  width,
  gutter,
  grid,
  yMax,
  subscribe,
  liveView,
  moving,
  watch,
}: Props) {
  const { palette, custom } = useTheme()
  const ceilingRef = useRef<HTMLSpanElement>(null)
  const shownMax = useRef(0)
  const shownText = useRef("")

  const buffers = useMemo(
    () => ({
      plus: new Float32Array(Math.max(1, Math.ceil(width))),
      minus: new Float32Array(Math.max(1, Math.ceil(width))),
    }),
    [width],
  )

  const ink = useMemo<CoverageInk>(
    () => ({
      plus: color,
      // The minus strand reads as the same track seen the other way, so it keeps the hue
      // and gives up some weight rather than taking a colour of its own
      minus: palette.mode === "dark" ? `${color}99` : `${color}77`,
      axis: palette.divider,
      grid: palette.action.hover,
    }),
    [color, palette],
  )

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, scale: Parameters<typeof drawCoverage>[0]["scale"]) => {
      const peakPlus = columnPeaks(buffers.plus, data.plus, scale)
      const peakMinus = data.minus ? columnPeaks(buffers.minus, data.minus, scale) : 0
      const seen = Math.max(peakPlus, peakMinus)
      // Held through the gesture: a lane rescaled every frame slides its own signal up and down
      // while the eye is trying to read it along the chromosome
      if (!moving() || shownMax.current === 0) {
        shownMax.current = seen > 0 ? seen * Y_HEADROOM : 1
      }
      const ceiling = yMax ?? shownMax.current
      drawCoverage({
        ctx,
        scale,
        height,
        plus: buffers.plus,
        minus: data.minus ? buffers.minus : null,
        max: ceiling,
        ink,
        grid,
      })
      // Written straight to the node: autoscaling live through React state would render the
      // whole stack on every frame of a drag
      const text = formatSignal(ceiling)
      if (ceilingRef.current && shownText.current !== text) {
        ceilingRef.current.textContent = text
        shownText.current = text
      }
    },
    [buffers, data, height, ink, grid, yMax, moving],
  )

  const watchThis = useMemo<LaneWatch | undefined>(
    () => (watch ? (el, onVisible) => watch(el, track.track_id, onVisible) : undefined),
    [watch, track.track_id],
  )

  const canvasRef = useLaneCanvas(subscribe, liveView, width, height, paint, watchThis)
  const plotRef = useRef<HTMLDivElement>(null)

  const read = useCallback(
    (clientX: number, clientY: number): Hovered | null => {
      const box = plotRef.current?.getBoundingClientRect()
      if (!box) return null
      const scale = frameScale(liveView(), width)
      const base = Math.floor(scale.toBase(clientX - box.left))
      return {
        base,
        plus: valueAt(data.plus, base),
        minus: data.minus ? valueAt(data.minus, base) : null,
        x: clientX,
        y: clientY,
      }
    },
    [data, liveView, width],
  )

  const { hovered: hover, onMove, clear: clearHover } = useHoverFrame(read, sameHover)

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // A drag is a pan, not a reading
      if (event.buttons !== 0 || data.absent) return
      onMove(event.clientX, event.clientY)
    },
    [data.absent, onMove],
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
        <Tooltip
          title={data.absent ? `${track.label} has no data on this chromosome` : track.label}
        >
          <Typography
            noWrap
            sx={{
              fontSize: 13,
              lineHeight: 1.3,
              color: data.absent ? "text.disabled" : "text.primary",
            }}
          >
            {track.label}
          </Typography>
        </Tooltip>
        <Typography
          component="span"
          sx={{ fontSize: 11.5, fontFamily: custom.monoFontFamily, color: "text.secondary" }}
        >
          {track.stranded ? "±" : ""}
          <Box component="span" ref={ceilingRef} />
        </Typography>
      </Box>
      <Box
        ref={plotRef}
        sx={{ position: "relative", flex: 1, minWidth: 0, height }}
        onPointerMove={onPointerMove}
        onPointerLeave={clearHover}
      >
        <canvas ref={canvasRef} style={{ display: "block", width, height }} />
        {data.absent && (
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
            not covered by this track
          </Typography>
        )}
      </Box>
      {hover && (
        <BrowserTooltip x={hover.x} y={hover.y}>
          <TipTitle>{track.label}</TipTitle>
          <TipLine>{`${hover.base.toLocaleString()} · ${track.group}`}</TipLine>
          {track.stranded ? (
            <>
              <TipLine>{`+ ${hover.plus === null ? "no signal" : formatSignal(hover.plus)}`}</TipLine>
              <TipLine>{`− ${hover.minus === null ? "no signal" : formatSignal(hover.minus)}`}</TipLine>
            </>
          ) : (
            <TipLine>{hover.plus === null ? "no signal here" : formatSignal(hover.plus)}</TipLine>
          )}
          {track.bin > 0 && <TipLine>{`binned to ${track.bin} bp`}</TipLine>}
        </BrowserTooltip>
      )}
    </Box>
  )
}

export default memo(TrackLane)
