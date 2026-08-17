// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, useRef } from "react"
import { alpha, Box, useTheme } from "@mui/material"
import type { CoverageTrack } from "@/types/browser"
import { AXIS_W, EDGE_PAD, GUTTER_W, LANE_GAP, MINUS_ALPHA, Y_HEADROOM } from "./constants"
import { binAt, columnPeaks, drawCoverage, type Bin, type CoverageInk } from "./drawCoverage"
import BrowserTooltip, { TipLine, TipTitle } from "./BrowserTooltip"
import LaneAxis, { type AxisHandle } from "./LaneAxis"
import LaneFrame from "./LaneFrame"
import LaneGutter from "./LaneGutter"
import { formatSignal } from "./yAxis"
import { formatLocus, formatPoint, formatSpan, frameScale } from "./scale"
import type { LaneData } from "./useCoverageData"
import { useLaneCanvas } from "./useLaneCanvas"
import { useHoverFrame } from "./useHoverFrame"
import type { LaneVisibility, LaneWatch } from "./useLaneVisibility"
import type { Painter } from "./useBrowserView"
import type { Viewport } from "./scale"

interface Props {
  track: CoverageTrack
  data: LaneData
  chrom: string
  group?: string
  flush?: boolean
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
  plus: Bin | null
  minus: Bin | null
  x: number
  y: number
}

const sameBin = (a: Bin | null, b: Bin | null) => a?.start === b?.start && a?.value === b?.value
const sameHover = (a: Hovered | null, b: Hovered | null) => {
  if (!a || !b) return a === b
  if (!a.plus && !a.minus && !b.plus && !b.minus) return a.base === b.base
  return sameBin(a.plus, b.plus) && sameBin(a.minus, b.minus)
}

const readingOf = (bin: Bin | null) =>
  bin === null ? "nothing recorded here" : `coverage = ${formatSignal(bin.value)}`

const binLabel = (chrom: string, hover: Hovered) => {
  const bin = hover.plus ?? hover.minus
  return bin
    ? `${formatLocus(chrom, bin.start, bin.end)} · ${formatSpan(bin.end - bin.start)}`
    : formatPoint(chrom, hover.base)
}

function TrackLane({
  track,
  data,
  chrom,
  group,
  flush,
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
  const axisRef = useRef<AxisHandle | null>(null)
  const peakRef = useRef<HTMLSpanElement>(null)
  const shownMax = useRef(0)
  const shownPeak = useRef(0)
  const shownText = useRef("")

  const peakWord = gutter - AXIS_W >= GUTTER_W ? "peak signal" : "peak"

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
      minus: alpha(color, MINUS_ALPHA),
      zero: palette.divider,
      grid: palette.action.hover,
    }),
    [color, palette],
  )

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, scale: Parameters<typeof drawCoverage>[0]["scale"]) => {
      const peakPlus = columnPeaks(buffers.plus, data.plus, scale)
      const peakMinus = data.minus ? columnPeaks(buffers.minus, data.minus, scale) : 0
      const seen = Math.max(peakPlus, peakMinus)
      if (!moving() || shownMax.current === 0) {
        shownMax.current = seen > 0 ? seen * Y_HEADROOM : 1
        shownPeak.current = seen
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
      axisRef.current?.draw(ceiling, data.minus !== null)
      const text = data.absent ? "\u00a0" : `${peakWord} ${formatSignal(shownPeak.current)}`
      if (peakRef.current && shownText.current !== text) {
        peakRef.current.textContent = text
        shownText.current = text
      }
    },
    [buffers, data, height, ink, grid, yMax, moving, peakWord],
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
        plus: binAt(data.plus, base),
        minus: data.minus ? binAt(data.minus, base) : null,
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
      <LaneGutter
        gutter={gutter}
        height={height}
        name={track.label}
        group={group}
        title={data.absent ? `${track.label} has no data on this chromosome` : track.label}
        dimmed={data.absent}
      >
        <Box component="span" ref={peakRef} />
      </LaneGutter>
      <LaneAxis height={height} handleRef={axisRef} />
      <Box
        ref={plotRef}
        sx={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height,
          bgcolor: custom.plotSurface,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={clearHover}
      >
        <canvas ref={canvasRef} style={{ display: "block", width, height }} />
        <LaneFrame flush={flush} />
        {data.absent && (
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
            No data for this chromosome
          </Box>
        )}
      </Box>
      {hover && (
        <BrowserTooltip x={hover.x} y={hover.y}>
          <TipTitle>{track.label}</TipTitle>
          <TipLine>{track.group}</TipLine>
          <TipLine>{binLabel(chrom, hover)}</TipLine>
          {track.stranded ? (
            <>
              <TipLine>{`forward strand · ${readingOf(hover.plus)}`}</TipLine>
              <TipLine>{`reverse strand · ${readingOf(hover.minus)}`}</TipLine>
            </>
          ) : (
            <TipLine>{readingOf(hover.plus)}</TipLine>
          )}
        </BrowserTooltip>
      )}
    </Box>
  )
}

export default memo(TrackLane)
