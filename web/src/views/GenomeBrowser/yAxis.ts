// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { AXIS_LABEL_GAP_PX, Y_TICK_GAP_PX, Y_TICK_MAX } from "./constants"

const STEPS = [1, 2, 5]

function stepFor(max: number, count: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const rungs = [magnitude / 10, magnitude, magnitude * 10]
    .flatMap((decade) => STEPS.map((unit) => decade * unit))
    .filter((step) => step <= max)
  return rungs.find((step) => Math.floor(max / step) <= count) ?? rungs[rungs.length - 1]
}

// Format a coverage value for compact labels.
export function formatSignal(value: number): string {
  const size = Math.abs(value)
  if (size >= 1000) return value.toExponential(1)
  if (size >= 10) return value.toFixed(0)
  if (size >= 1) return value.toFixed(1)
  if (size > 0 && size < 0.01) return value.toExponential(1)
  return value.toFixed(2)
}

// Return sparse, rounded y-axis ticks in ascending order.
export function yTicks(max: number, reach: number): number[] {
  if (!(max > 0) || !Number.isFinite(max) || !(reach > 0)) return []
  const allowed = Math.min(Math.max(Math.floor(reach / Y_TICK_GAP_PX), 1), Y_TICK_MAX)
  const step = stepFor(max, allowed)
  if (!(step > 0)) return []
  const out: number[] = []
  for (let i = 1; i * step <= max; i++) out.push(i * step)
  return out.slice(0, allowed)
}

export interface AxisMark {
  value: number
  pinned: boolean
}

// Merge automatic ticks with fixed marks without overlapping labels.
export function axisMarks(max: number, reach: number, pinned: readonly number[] = []): AxisMark[] {
  if (!(max > 0) || !(reach > 0)) return []
  const px = (value: number) => (value / max) * reach
  const held = pinned.filter((value) => value > 0 && value <= max && px(value) >= AXIS_LABEL_GAP_PX)
  const ticks = yTicks(max, reach).filter((value) =>
    held.every((mark) => Math.abs(px(value) - px(mark)) >= AXIS_LABEL_GAP_PX),
  )
  return [...new Set([...held, ...ticks])]
    .sort((a, b) => a - b)
    .map((value) => ({ value, pinned: held.includes(value) }))
}
