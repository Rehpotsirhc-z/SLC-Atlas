// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Convert between genomic coordinates and screen positions */

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
  /** A span in pixels, never thinner than a feature the eye can find */
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

/**
 * The scale for one frame, made once. Every lane is painted from the same viewport object at the
 * same plot width, so two dozen calls a frame are two dozen copies of the same three closures.
 * Keyed on the object rather than on its numbers, a viewport being replaced and never edited.
 */
export function frameScale(view: Viewport, width: number): Scale {
  if (heldScale && heldView === view && heldWidth === width) return heldScale
  heldScale = scaleFor(view, width)
  heldView = view
  heldWidth = width
  return heldScale
}

/** Hold a viewport inside the bytes that exist, keeping its width where it can. */
export function clampView(view: Viewport, bounds: Viewport): Viewport {
  const limit = bounds.end - bounds.start
  const width = Math.min(Math.max(view.end - view.start, MIN_VIEW_BP), limit)
  let start = view.start
  if (start < bounds.start) start = bounds.start
  if (start + width > bounds.end) start = bounds.end - width
  return { start: Math.round(start), end: Math.round(start + width) }
}

/** Zoom by a factor about one point of the view, which is what the cursor sits on. */
export function zoomAbout(
  view: Viewport,
  factor: number,
  atBase: number,
  bounds: Viewport,
): Viewport {
  const width = view.end - view.start
  const next = width / factor
  const share = (atBase - view.start) / width
  return clampView({ start: atBase - share * next, end: atBase - share * next + next }, bounds)
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

/** A coordinate written at the precision the tick spacing justifies. */
export function tickLabel(base: number, step: number): string {
  if (step >= 1_000_000) return `${round(base / 1_000_000, step / 1_000_000)} Mb`
  if (step >= 1_000) return `${round(base / 1_000, step / 1_000)} kb`
  return base.toLocaleString()
}

function round(value: number, step: number): string {
  const places = Math.max(0, -Math.floor(Math.log10(step)))
  return value.toFixed(places)
}

/** The locus as a person would type it back into the search box. */
export function formatLocus(chrom: string, start: number, end: number): string {
  return `${chrom}:${formatRange(start, end)}`
}

/** Format one genomic position. */
export function formatPoint(chrom: string, base: number): string {
  return `${chrom}:${Math.round(base).toLocaleString()}`
}

export function formatSpan(bases: number): string {
  if (bases >= 1_000_000) return `${(bases / 1_000_000).toFixed(2)} Mb`
  if (bases >= 1_000) return `${(bases / 1_000).toFixed(1)} kb`
  return `${Math.round(bases)} bp`
}
