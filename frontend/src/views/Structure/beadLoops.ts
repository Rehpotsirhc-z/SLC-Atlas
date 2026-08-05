// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { RESIDUES, RESIDUES_MAX_DEPTH } from "./constants"
import type { Side } from "./membraneSides"
import type { Point } from "./regionsLayout"

export interface LoopSize {
  depth: number
  run: number
  rows: number
  foot: number
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

const footFor = (run: number, rows: number, terminus: boolean) =>
  run + (!terminus && rows > 1 ? RESIDUES.jog : 0)

const pathLength = (points: Point[]) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0)

function curve(from: Point, control: Point, to: Point): Point[] {
  const points: Point[] = []
  for (let i = 1; i <= RESIDUES.curveSamples; i++) {
    const t = i / RESIDUES.curveSamples
    const u = 1 - t
    points.push({
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    })
  }
  return points
}

export function loopGuide(
  from: Point,
  to: Point | null,
  side: Side,
  size: LoopSize,
  reach: number,
): Point[] {
  const dir = side === "outside" ? -1 : 1
  const inner = size.depth - (size.rows - 1) * RESIDUES.rowStep
  const rowY = (row: number) => from.y + dir * (inner + row * RESIDUES.rowStep)
  const far = from.x + reach

  const points: Point[] = [from]
  const away = far < from.x ? -1 : 1

  if (size.rows === 1 && to) {
    points.push(...curve(from, { x: (from.x + to.x) / 2, y: from.y + dir * 2 * size.depth }, to))
    return points
  }

  points.push(...curve(from, { x: from.x, y: rowY(0) }, { x: far, y: rowY(0) }))

  for (let row = 1; row < size.rows; row++) {
    const odd = row % 2 === 1
    const at = odd ? far : from.x
    const end = odd ? from.x : far
    const y = rowY(row)
    points.push(
      ...curve(
        { x: at, y: rowY(row - 1) },
        { x: at + (odd ? away : -away) * RESIDUES.rowStep, y: (rowY(row - 1) + y) / 2 },
        { x: at, y },
      ),
    )
    points.push(
      ...curve({ x: at, y }, { x: (at + end) / 2, y: y + dir * 2 * RESIDUES.bow }, { x: end, y }),
    )
  }

  if (to) {
    const out = { x: far, y: rowY(size.rows - 1) }
    points.push(...curve(out, { x: to.x, y: out.y }, to))
  }
  return points
}

function fitRun(need: number, depth: number, rows: number, terminus: boolean): number {
  const corners = need - (terminus ? depth : 2 * depth + (rows > 1 ? RESIDUES.jog : 0))
  let run = Math.max(corners / rows, RESIDUES.minRun)
  for (let pass = 0; pass < 3; pass++) {
    const size = { depth, run, rows, foot: footFor(run, rows, terminus) }
    const to = terminus ? null : { x: size.foot, y: 0 }
    const length = pathLength(loopGuide({ x: 0, y: 0 }, to, "inside", size, run))
    if (length <= 0) break
    run = Math.max(run + (need - length) / rows, RESIDUES.minRun)
  }
  return run
}

export function sizeLoop(residues: number, terminus: boolean): LoopSize {
  const need = (residues + 1) * RESIDUES.spacing
  let rows = 1
  let depth = clamp(
    RESIDUES.minBow + residues * RESIDUES.risePerResidue,
    RESIDUES.minBow,
    RESIDUES_MAX_DEPTH,
  )
  let run = fitRun(need, depth, rows, terminus)
  while (run > RESIDUES.maxRun && rows < RESIDUES.maxRows) {
    rows += 2
    depth = RESIDUES.minRise + (rows - 1) * RESIDUES.rowStep
    run = fitRun(need, depth, rows, terminus)
  }
  return { depth, run, rows, foot: footFor(run, rows, terminus) }
}

export function chainPath(points: Point[]): string {
  if (points.length < 2) return ""
  const at = (i: number) => points[Math.min(Math.max(i, 0), points.length - 1)]
  const xy = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  const d = [`M${xy(points[0])}`]
  for (let i = 0; i < points.length - 1; i++) {
    const [before, from, to, after] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const first = { x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 }
    const second = { x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 }
    d.push(`C${xy(first)} ${xy(second)} ${xy(to)}`)
  }
  return d.join(" ")
}

export function spread(guide: Point[], count: number): Point[] {
  if (count <= 0) return []
  const lengths = guide.slice(1).map((p, i) => Math.hypot(p.x - guide[i].x, p.y - guide[i].y))
  const total = lengths.reduce((sum, l) => sum + l, 0)
  if (total === 0) return Array.from({ length: count }, () => guide[0])

  const out: Point[] = []
  let leg = 0
  let consumed = 0
  for (let k = 0; k < count; k++) {
    const target = (total * (k + 1)) / (count + 1)
    while (leg < lengths.length - 1 && consumed + lengths[leg] < target) {
      consumed += lengths[leg]
      leg += 1
    }
    const t = lengths[leg] ? (target - consumed) / lengths[leg] : 0
    out.push({
      x: guide[leg].x + (guide[leg + 1].x - guide[leg].x) * t,
      y: guide[leg].y + (guide[leg + 1].y - guide[leg].y) * t,
    })
  }
  return out
}
