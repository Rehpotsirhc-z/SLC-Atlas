// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { TRACK } from "./constants"

export interface AxisTick {
  residue: number
  x: number
}

export interface Window {
  from: number
  to: number
}

export interface Box {
  x: number
  width: number
}

export interface ResidueAxis {
  plotLeft: number
  plotRight: number
  perResidue: number
  toX: (residue: number) => number
  boxFor: (start: number, end: number, minimum: number, limit?: Window) => Box
  ticks: AxisTick[]
}

function axisTicks(length: number, toX: (residue: number) => number): AxisTick[] {
  const ticks: AxisTick[] = [{ residue: 1, x: toX(1) }]
  for (let r = TRACK.tickSpacing; r < length; r += TRACK.tickSpacing) {
    ticks.push({ residue: r, x: toX(r) })
  }

  if (length - ticks[ticks.length - 1].residue < TRACK.tickSpacing / 3) ticks.pop()
  ticks.push({ residue: length, x: toX(length) })
  return ticks
}

export function residueAxis(length: number, width: number): ResidueAxis {
  const plotLeft = TRACK.gutter + TRACK.padX
  const span = Math.max(length - 1, 1)
  const inner = Math.max(width - TRACK.padRight - plotLeft, 1)
  const plotRight = plotLeft + inner
  const toX = (residue: number) => plotLeft + ((residue - 1) / span) * inner
  const perResidue = inner / span

  const boxFor = (start: number, end: number, minimum: number, limit?: Window): Box => {
    const room = limit ? limit.to - limit.from : Number.POSITIVE_INFINITY
    const boxWidth = Math.min(Math.max(toX(end) - toX(start) + perResidue, minimum), room)
    const centred = (toX(start) + toX(end) + perResidue - boxWidth) / 2
    if (!limit) return { x: centred, width: boxWidth }
    return { x: Math.min(Math.max(centred, limit.from), limit.to - boxWidth), width: boxWidth }
  }

  return { plotLeft, plotRight, perResidue, toX, boxFor, ticks: axisTicks(length, toX) }
}
