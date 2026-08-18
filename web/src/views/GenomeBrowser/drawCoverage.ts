// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Draw coverage tracks on a canvas

import type { CoverageArrays } from "@/api/bbi"
import { COVERAGE_RECORDS_PER_PX } from "./constants"
import { coverageAtStride } from "./coverageSummary"
import type { Scale, Viewport } from "./scale"
import { yTicks } from "./yAxis"

export interface CoverageInk {
  plus: string
  minus: string
  zero: string
  grid: string
}

// First interval that could touch the view, so a wide slice is not walked end to end.
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

// First interval starting at or after a base, which is one past the last one in view.
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

// Choose a summary level that keeps the record count proportional to the lane width
function seriesFor(data: CoverageArrays, view: Viewport, width: number): CoverageArrays {
  const seen = firstAfter(data.starts, view.end) - firstFrom(data.starts, data.ends, view.start)
  const budget = Math.max(width, 1) * COVERAGE_RECORDS_PER_PX
  if (seen <= budget) return data
  return coverageAtStride(data, 2 ** Math.ceil(Math.log2(seen / budget)))
}

// Reuse the caller's buffer to avoid allocating once per lane on every drag frame
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

// Highest full-resolution score in the viewport
export function peakInView(data: CoverageArrays, view: Viewport): number {
  const { starts, ends, scores } = data
  let peak = 0
  for (let i = firstFrom(starts, ends, view.start); i < starts.length; i++) {
    if (starts[i] >= view.end) break
    if (scores[i] > peak) peak = scores[i]
  }
  return peak
}

export interface Bin {
  start: number
  end: number
  value: number
}

// Return the record covering a base, or null where no interval was recorded.
export function binAt(data: CoverageArrays, base: number): Bin | null {
  const { starts, ends, scores } = data
  const index = firstFrom(starts, ends, base)
  if (index >= starts.length || starts[index] > base) return null
  return { start: starts[index], end: ends[index], value: scores[index] }
}

// Add vertices only where column height changes to keep mostly empty paths small
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
    for (const value of yTicks(ceiling, reach)) {
      const offset = (value / ceiling) * reach
      for (const y of stranded ? [baseline - offset, baseline + offset] : [baseline - offset]) {
        const at = Math.round(y) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, at)
        ctx.lineTo(scale.width, at)
        ctx.stroke()
      }
    }
  }

  ctx.fillStyle = ink.plus
  fillColumns(ctx, plus, baseline, reach, ceiling, 1)
  if (minus) {
    ctx.fillStyle = ink.minus
    fillColumns(ctx, minus, baseline, reach, ceiling, -1)
  }

  if (stranded) {
    ctx.strokeStyle = ink.zero
    ctx.lineWidth = 1
    const rule = Math.round(baseline) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, rule)
    ctx.lineTo(scale.width, rule)
    ctx.stroke()
  }
}
