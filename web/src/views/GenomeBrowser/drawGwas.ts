// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * The GWAS lane: one mark per variant at its own significance, colored by which way the
 * effect goes. A p-value that underflowed to zero arrives as a null and is drawn in a band
 * above the scale, since placing it at the largest float the language has would stretch the
 * axis until every real variant sat on the floor.
 */

import type { GwasPoint } from "@/types/browser"
import { GWAS_POINT_R, GWAS_SIGNIFICANCE_P } from "./constants"
import type { Scale } from "./scale"

export const SIGNIFICANCE_Y = -Math.log10(GWAS_SIGNIFICANCE_P)

export interface GwasInk {
  raised: string
  lowered: string
  neutral: string
  axis: string
  grid: string
  significance: string
}

export interface GwasFrame {
  ctx: CanvasRenderingContext2D
  scale: Scale
  height: number
  points: GwasPoint[]
  max: number
  ink: GwasInk
  grid: boolean
  showSignificance: boolean
}

/**
 * The first variant at or after a position. The points are held in position order, so a study
 * covering a whole chromosome is still read from where the view starts rather than from its
 * first variant.
 */
export function firstFrom(points: GwasPoint[], base: number): number {
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].position < base) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Height the axis needs, kept at the significance line so the rule is always meaningful. */
export function gwasCeiling(points: GwasPoint[], from: number, to: number): number {
  let peak = 0
  let underflowed = false
  for (let i = firstFrom(points, from); i < points.length; i++) {
    const point = points[i]
    if (point.position >= to) break
    if (point.neg_log10_p === null) underflowed = true
    else if (point.neg_log10_p > peak) peak = point.neg_log10_p
  }
  if (underflowed) peak = Math.max(peak, SIGNIFICANCE_Y)
  return Math.max(peak, 2)
}

export function drawGwas({
  ctx,
  scale,
  height,
  points,
  max,
  ink,
  grid,
  showSignificance,
}: GwasFrame) {
  ctx.clearRect(0, 0, scale.width, height)
  // The top sliver is reserved for variants whose p-value underflowed, so a real point never
  // shares a row with one that has no measurable value
  const overflowY = GWAS_POINT_R + 1
  const plotTop = overflowY * 2
  const ceiling = max > 0 ? max : 1
  const toY = (value: number) => height - (value / ceiling) * (height - plotTop)

  if (grid) {
    ctx.strokeStyle = ink.grid
    ctx.lineWidth = 1
    const y = Math.round(toY(ceiling / 2)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(scale.width, y)
    ctx.stroke()
  }

  if (showSignificance && SIGNIFICANCE_Y <= ceiling) {
    ctx.save()
    ctx.strokeStyle = ink.significance
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    const y = Math.round(toY(SIGNIFICANCE_Y)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(scale.width, y)
    ctx.stroke()
    ctx.restore()
  }

  // One path per color rather than one per variant: a window can hold thousands of them, and
  // each fill of its own is a state change the lane pays for on every frame of a drag
  const raised = new Path2D()
  const lowered = new Path2D()
  const neutral = new Path2D()
  for (let i = firstFrom(points, scale.start); i < points.length; i++) {
    const point = points[i]
    if (point.position >= scale.end) break
    const x = scale.toX(point.position)
    const y = point.neg_log10_p === null ? overflowY : toY(point.neg_log10_p)
    const path = point.beta === null ? neutral : point.beta > 0 ? raised : lowered
    path.moveTo(x + GWAS_POINT_R, y)
    path.arc(x, y, GWAS_POINT_R, 0, Math.PI * 2)
  }
  ctx.fillStyle = ink.neutral
  ctx.fill(neutral)
  ctx.fillStyle = ink.raised
  ctx.fill(raised)
  ctx.fillStyle = ink.lowered
  ctx.fill(lowered)

  ctx.strokeStyle = ink.axis
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height - 0.5)
  ctx.lineTo(scale.width, height - 0.5)
  ctx.stroke()
}

/** The variant nearest a pixel, for the tooltip. */
export function gwasNear(
  points: GwasPoint[],
  scale: Scale,
  x: number,
  y: number,
  height: number,
  max: number,
): GwasPoint | null {
  const overflowY = GWAS_POINT_R + 1
  const plotTop = overflowY * 2
  const ceiling = max > 0 ? max : 1
  const reach = GWAS_POINT_R * 3
  let best: GwasPoint | null = null
  let bestDistance = reach * reach
  for (let i = firstFrom(points, scale.start); i < points.length; i++) {
    const point = points[i]
    if (point.position >= scale.end) break
    const dx = scale.toX(point.position) - x
    if (dx * dx > bestDistance) continue
    const py =
      point.neg_log10_p === null
        ? overflowY
        : height - (point.neg_log10_p / ceiling) * (height - plotTop)
    const distance = dx * dx + (py - y) * (py - y)
    if (distance <= bestDistance) {
      bestDistance = distance
      best = point
    }
  }
  return best
}
