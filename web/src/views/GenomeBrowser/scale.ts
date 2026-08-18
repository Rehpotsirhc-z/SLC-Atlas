// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Convert between genomic coordinates and screen positions

import { formatRange } from "@/utils/format"
import { MIN_FEATURE_PX, MIN_VIEW_BP } from "./constants"

export interface Viewport {
  start: number
  end: number
}

export interface Scale {
  start: number
  end: number
  width: number
  basesPerPixel: number
  toX: (base: number) => number
  toBase: (x: number) => number
  // Keep narrow features visible
  boxFor: (start: number, end: number) => { x: number; width: number }
}

export function scaleFor(view: Viewport, width: number): Scale {
  const span = Math.max(view.end - view.start, 1)
  const px = Math.max(width, 1)
  const perPixel = span / px
  const toX = (base: number) => ((base - view.start) / span) * px
  return {
    start: view.start,
    end: view.end,
    width: px,
    basesPerPixel: perPixel,
    toX,
    toBase: (x: number) => view.start + (x / px) * span,
    boxFor: (start: number, end: number) => {
      const left = toX(start)
      const drawn = Math.max(toX(end) - left, MIN_FEATURE_PX)
      return { x: left, width: drawn }
    },
  }
}

let heldScale: Scale | null = null
let heldView: Viewport | null = null
let heldWidth = 0

// Reuse the scale shared by every lane in the current frame
export function frameScale(view: Viewport, width: number): Scale {
  if (heldScale && heldView === view && heldWidth === width) return heldScale
  heldScale = scaleFor(view, width)
  heldView = view
  heldWidth = width
  return heldScale
}

// Keep the viewport within chromosome bounds without shrinking it when possible
export function clampView(view: Viewport, bounds: Viewport): Viewport {
  const limit = bounds.end - bounds.start
  const width = Math.min(Math.max(view.end - view.start, MIN_VIEW_BP), limit)
  let start = view.start
  if (start < bounds.start) start = bounds.start
  if (start + width > bounds.end) start = bounds.end - width
  return { start: Math.round(start), end: Math.round(start + width) }
}

// Zoom around a fixed genomic position
export function zoomAbout(
  view: Viewport,
  factor: number,
  atBase: number,
  bounds: Viewport,
): Viewport {
  const width = view.end - view.start
  // Clamp the target width before anchoring, so a zoom the limit refuses keeps the cursor's base
  // where it was rather than sliding start to hold a share of a width the clamp then discards
  const next = Math.min(Math.max(width / factor, MIN_VIEW_BP), bounds.end - bounds.start)
  const share = (atBase - view.start) / width
  const start = atBase - share * next
  return clampView({ start, end: start + next }, bounds)
}

// Ticks land on a round number of bases, so the labels read as coordinates rather than as
// whatever the window width happened to divide into
const STEPS = [1, 2, 5]

export function tickStep(span: number, width: number, minGapPx: number): number {
  const target = (span / Math.max(width, 1)) * minGapPx
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(target, 1)))
  for (const step of STEPS) {
    if (magnitude * step >= target) return magnitude * step
  }
  return magnitude * 10
}

export interface Tick {
  base: number
  x: number
  label: string
}

export function ticksFor(scale: Scale, minGapPx: number): Tick[] {
  const step = tickStep(scale.end - scale.start, scale.width, minGapPx)
  const first = Math.ceil(scale.start / step) * step
  const out: Tick[] = []
  for (let base = first; base <= scale.end; base += step) {
    out.push({ base, x: scale.toX(base), label: tickLabel(base, step) })
  }
  return out
}

export interface RulerTick {
  // The tick mark position
  x: number
  label: string
  // The label center, nudged inside the plot so an edge label is not clipped
  labelX: number
  showLabel: boolean
}

// Tick marks with their labels placed for the ruler. Interior labels sit centered on their tick
// and never touch, since a tick step is at least a label wide. An edge label centered on its tick
// would spill off the plot, so it is nudged inside; when the nudge would push it into its neighbor
// (a deep zoom makes a coordinate wider than the space beside the edge) the label is dropped and
// only its tick mark remains. `measure` gives a label's width in the caller's medium.
export function rulerTicks(
  scale: Scale,
  minGapPx: number,
  edgeGapPx: number,
  measure: (label: string) => number,
): RulerTick[] {
  const items = ticksFor(scale, minGapPx).map((tick) => {
    const half = measure(tick.label) / 2
    const labelX = Math.min(Math.max(tick.x, half), scale.width - half)
    return { x: tick.x, label: tick.label, labelX, half, showLabel: true }
  })
  const n = items.length
  if (n >= 2 && items[0].labelX + items[0].half + edgeGapPx > items[1].labelX - items[1].half) {
    items[0].showLabel = false
  }
  if (
    n >= 2 &&
    items[n - 2].showLabel &&
    items[n - 1].labelX - items[n - 1].half - edgeGapPx < items[n - 2].labelX + items[n - 2].half
  ) {
    items[n - 1].showLabel = false
  }
  return items
}

// A coordinate written at the precision the tick spacing justifies.
export function tickLabel(base: number, step: number): string {
  if (step >= 1_000_000) return `${round(base / 1_000_000, step / 1_000_000)} Mb`
  if (step >= 1_000) return `${round(base / 1_000, step / 1_000)} kb`
  return base.toLocaleString()
}

function round(value: number, step: number): string {
  const places = Math.max(0, -Math.floor(Math.log10(step)))
  return value.toFixed(places)
}

// Format a locus for display or search input
export function formatLocus(chrom: string, start: number, end: number): string {
  return `${chrom}:${formatRange(start, end)}`
}

// Format one genomic position.
export function formatPoint(chrom: string, base: number): string {
  return `${chrom}:${Math.round(base).toLocaleString()}`
}

export function formatSpan(bases: number): string {
  if (bases >= 1_000_000) return `${(bases / 1_000_000).toFixed(2)} Mb`
  if (bases >= 1_000) return `${(bases / 1_000).toFixed(1)} kb`
  return `${Math.round(bases)} bp`
}
