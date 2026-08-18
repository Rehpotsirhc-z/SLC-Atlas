// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Null significance values represent p-values that underflowed to zero and are drawn above the
// scale so they do not flatten the remaining variants

import type { VariantBlock } from "@/api/bbi"
import { GWAS_POINT_R, GWAS_SIGNIFICANCE_P } from "./constants"
import type { Scale } from "./scale"
import { yTicks } from "./yAxis"

export const SIGNIFICANCE_Y = -Math.log10(GWAS_SIGNIFICANCE_P)

// Reserve the top row for p-values too small to represent
export const GWAS_PLOT_TOP = (GWAS_POINT_R + 1) * 2

export interface GwasInk {
  raised: string
  lowered: string
  neutral: string
  grid: string
  significance: string
}

export interface GwasFrame {
  ctx: CanvasRenderingContext2D
  scale: Scale
  height: number
  block: VariantBlock
  max: number
  ink: GwasInk
  grid: boolean
  showSignificance: boolean
}

// Find the first visible variant without scanning from the start of a chromosome-wide study
export function firstFrom(block: VariantBlock, base: number): number {
  const positions = block.positions
  let lo = 0
  let hi = positions.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (positions[mid] < base) lo = mid + 1
    else hi = mid
  }
  return lo
}

// Height the axis needs, kept at the significance line so the rule is always meaningful.
export function gwasCeiling(block: VariantBlock, from: number, to: number): number {
  const { positions, values } = block
  let peak = 0
  let underflowed = false
  for (let i = firstFrom(block, from); i < positions.length; i++) {
    if (positions[i] >= to) break
    const value = values[i]
    if (Number.isNaN(value)) underflowed = true
    else if (value > peak) peak = value
  }
  if (underflowed) peak = Math.max(peak, SIGNIFICANCE_Y)
  return Math.max(peak, 2)
}

export function drawGwas({
  ctx,
  scale,
  height,
  block,
  max,
  ink,
  grid,
  showSignificance,
}: GwasFrame) {
  ctx.clearRect(0, 0, scale.width, height)
  const overflowY = GWAS_POINT_R + 1
  const ceiling = max > 0 ? max : 1
  const toY = (value: number) => height - (value / ceiling) * (height - GWAS_PLOT_TOP)

  if (grid) {
    ctx.strokeStyle = ink.grid
    ctx.lineWidth = 1
    for (const value of yTicks(ceiling, height - GWAS_PLOT_TOP)) {
      const y = Math.round(toY(value)) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(scale.width, y)
      ctx.stroke()
    }
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
  const { positions, values, betas } = block
  for (let i = firstFrom(block, scale.start); i < positions.length; i++) {
    if (positions[i] >= scale.end) break
    const x = scale.toX(positions[i])
    const value = values[i]
    const y = Number.isNaN(value) ? overflowY : toY(value)
    const beta = betas[i]
    const path = Number.isNaN(beta) ? neutral : beta > 0 ? raised : lowered
    path.moveTo(x + GWAS_POINT_R, y)
    path.arc(x, y, GWAS_POINT_R, 0, Math.PI * 2)
  }
  ctx.fillStyle = ink.neutral
  ctx.fill(neutral)
  ctx.fillStyle = ink.raised
  ctx.fill(raised)
  ctx.fillStyle = ink.lowered
  ctx.fill(lowered)
}

// Return the nearest visible variant index, or -1
export function gwasNear(
  block: VariantBlock,
  scale: Scale,
  x: number,
  y: number,
  height: number,
  max: number,
): number {
  const overflowY = GWAS_POINT_R + 1
  const plotTop = overflowY * 2
  const ceiling = max > 0 ? max : 1
  const reach = GWAS_POINT_R * 3
  const { positions, values } = block
  let best = -1
  let bestDistance = reach * reach
  for (let i = firstFrom(block, scale.start); i < positions.length; i++) {
    if (positions[i] >= scale.end) break
    const dx = scale.toX(positions[i]) - x
    if (dx * dx > bestDistance) continue
    const value = values[i]
    const py = Number.isNaN(value) ? overflowY : height - (value / ceiling) * (height - plotTop)
    const distance = dx * dx + (py - y) * (py - y)
    if (distance <= bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}
