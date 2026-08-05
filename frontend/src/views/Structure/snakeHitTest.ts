// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { SNAKE } from "./constants"
import type { Bead } from "./snakeLayout"

export interface BeadGrid {
  cells: Map<string, Bead[]>
}

export const EMPTY_GRID: BeadGrid = { cells: new Map<string, Bead[]>() }

const cellOf = (value: number) => Math.floor(value / SNAKE.hitRadius)
const cellKey = (column: number, row: number) => `${column}:${row}`

export function indexBeads(beads: Iterable<Bead>): BeadGrid {
  const cells = new Map<string, Bead[]>()
  for (const bead of beads) {
    const key = cellKey(cellOf(bead.x), cellOf(bead.y))
    const held = cells.get(key)
    if (held) held.push(bead)
    else cells.set(key, [bead])
  }
  return { cells }
}

export function beadNear(grid: BeadGrid, x: number, y: number): Bead | null {
  const column = cellOf(x)
  const row = cellOf(y)
  let best: Bead | null = null
  let nearest = SNAKE.hitRadius * SNAKE.hitRadius
  for (let c = column - 1; c <= column + 1; c++) {
    for (let r = row - 1; r <= row + 1; r++) {
      for (const bead of grid.cells.get(cellKey(c, r)) ?? []) {
        const distance = (bead.x - x) ** 2 + (bead.y - y) ** 2
        if (distance < nearest) {
          best = bead
          nearest = distance
        }
      }
    }
  }
  return best
}
