// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Draw coverage tracks on a canvas */

import type { CoverageArrays } from "@/api/bigwig"
import { COVERAGE_RECORDS_PER_PX } from "./constants"
import { coverageAtStride } from "./coverageSummary"
import type { Scale, Viewport } from "./scale"

export interface CoverageInk {
  plus: string
  minus: string
  axis: string
  grid: string
}

/** First interval that could touch the view, so a wide slice is not walked end to end. */
function firstFrom(starts: Int32Array, ends: Int32Array, base: number): number {
  let lo = 0
  let hi = starts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (ends[mid] <= base) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** First interval starting at or after a base, which is one past the last one in view. */
function firstAfter(starts: Int32Array, base: number): number {
  let lo = 0
  let hi = starts.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] < base) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The records to draw a view from, at whatever stride keeps the walk near the width of the
 * lane. A view holding a hundred records to the pixel is drawn from a merged copy of them,
 * which gives every column the same peak for a fraction of the walk.
 */
function seriesFor(data: CoverageArrays, view: Viewport, width: number): CoverageArrays {
  const seen = firstAfter(data.starts, view.end) - firstFrom(data.starts, data.ends, view.start)
  const budget = Math.max(width, 1) * COVERAGE_RECORDS_PER_PX
  if (seen <= budget) return data
  return coverageAtStride(data, 2 ** Math.ceil(Math.log2(seen / budget)))
}

/**
 * Tallest value per pixel column. The buffer is supplied by the caller and reused across
 * frames, because a drag allocates this once per lane per frame otherwise.
 */
export function columnPeaks(out: Float32Array, data: CoverageArrays, scale: Scale): number {
  out.fill(0)
  const width = out.length
  const { starts, ends, scores } = seriesFor(data, scale, width)
  let peak = 0
  for (let i = firstFrom(starts, ends, scale.start); i < starts.length; i++) {
    if (starts[i] >= scale.end) break
    const value = scores[i]
    if (!(value > 0)) continue
    let from = Math.floor(scale.toX(starts[i]))
    let to = Math.ceil(scale.toX(ends[i]))
    if (to <= from) to = from + 1
    if (from < 0) from = 0
    if (to > width) to = width
    for (let x = from; x < to; x++) {
      if (value > out[x]) out[x] = value
    }
    if (value > peak) peak = value
  }
  return peak
}

/** The tallest the track stands anywhere in a view, at full resolution. */
export function peakInView(data: CoverageArrays, view: Viewport): number {
  const { starts, ends, scores } = data
  let peak = 0
  for (let i = firstFrom(starts, ends, view.start); i < starts.length; i++) {
    if (starts[i] >= view.end) break
    if (scores[i] > peak) peak = scores[i]
  }
  return peak
}

/** The value the track carries at one base, or null where it carries none. */
export function valueAt(data: CoverageArrays, base: number): number | null {
  const { starts, ends, scores } = data
  const index = firstFrom(starts, ends, base)
  if (index >= starts.length || starts[index] > base) return null
  return scores[index]
}

/**
 * The outline of the columns, as one path. A vertex is only put down where the height changes,
 * since a lane is mostly flat and mostly empty: writing two of them per pixel is most of what
 * a stack of two dozen lanes costs to draw.
 */
function fillColumns(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  baseline: number,
  reach: number,
  max: number,
  sign: 1 | -1,
) {
  const width = peaks.length
  const perUnit = reach / max
  ctx.beginPath()
  ctx.moveTo(0, baseline)
  let held = baseline
  for (let x = 0; x < width; x++) {
    const value = peaks[x]
    const y = value > 0 ? baseline - sign * Math.min(value, max) * perUnit : baseline
    if (y === held) continue
    ctx.lineTo(x, held)
    ctx.lineTo(x, y)
    held = y
  }
  ctx.lineTo(width, held)
  ctx.lineTo(width, baseline)
  ctx.closePath()
  ctx.fill()
}

export interface CoverageFrame {
  ctx: CanvasRenderingContext2D
  scale: Scale
  height: number
  plus: Float32Array
  minus: Float32Array | null
  max: number
  ink: CoverageInk
  grid: boolean
}

export function drawCoverage({ ctx, scale, height, plus, minus, max, ink, grid }: CoverageFrame) {
  ctx.clearRect(0, 0, scale.width, height)
  const stranded = minus !== null
  const baseline = stranded ? height / 2 : height
  const reach = stranded ? height / 2 : height
  const ceiling = max > 0 ? max : 1

  if (grid) {
    ctx.strokeStyle = ink.grid
    ctx.lineWidth = 1
    for (const share of stranded ? [0.25, 0.75] : [0.5]) {
      const y = Math.round(height * share) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(scale.width, y)
      ctx.stroke()
    }
  }

  ctx.fillStyle = ink.plus
  fillColumns(ctx, plus, baseline, reach, ceiling, 1)
  if (minus) {
    ctx.fillStyle = ink.minus
    fillColumns(ctx, minus, baseline, reach, ceiling, -1)
  }

  ctx.strokeStyle = ink.axis
  ctx.lineWidth = 1
  const rule = Math.round(baseline) + (stranded ? 0.5 : -0.5)
  ctx.beginPath()
  ctx.moveTo(0, rule)
  ctx.lineTo(scale.width, rule)
  ctx.stroke()
}
