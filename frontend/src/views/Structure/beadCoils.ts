// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { SegmentModel } from "./chainModel"
import { RESIDUES, RESIDUES_BAND } from "./constants"
import type { Point } from "./regionsLayout"

function shareOut(count: number, lines: number): number[] {
  const base = Math.floor(count / lines)
  const extra = count % lines
  return Array.from({ length: lines }, (_, i) => base + (i < extra ? 1 : 0))
}

const halfWidth = (widest: number) => ((widest - 1) / 2) * RESIDUES.spacing

const crossingRows = (count: number) => Math.max(1, Math.min(RESIDUES.coilRows, count))
const reentrantDepth = Math.floor(RESIDUES_BAND / 2 / RESIDUES.spacing) + 1

function reentrantColumns(count: number): number {
  const columns = Math.ceil(count / reentrantDepth)
  return Math.max(2, columns + (columns % 2))
}

function crossingPoints(count: number, centre: number, entry: number, down: boolean): Point[] {
  const rows = shareOut(count, crossingRows(count))
  const points: Point[] = []
  rows.forEach((held, row) => {
    const y = entry + (down ? 1 : -1) * row * RESIDUES.spacing
    for (let i = 0; i < held; i++) {
      const at = row % 2 === 0 ? i : held - 1 - i
      points.push({ x: centre + (at - (held - 1) / 2) * RESIDUES.spacing, y })
    }
  })
  return points
}

function reentrantPoints(count: number, centre: number, entry: number, down: boolean): Point[] {
  const columns = shareOut(count, reentrantColumns(count))
  const points: Point[] = []
  columns.forEach((held, column) => {
    const x = centre + (column - (columns.length - 1) / 2) * RESIDUES.spacing
    for (let i = 0; i < held; i++) {
      const step = column % 2 === 0 ? i : held - 1 - i
      points.push({ x, y: entry + (down ? 1 : -1) * step * RESIDUES.spacing })
    }
  })
  return points
}

const returnsToItsFace = (segment: SegmentModel) => segment.entrySide === segment.exitSide

export function segmentPoints(
  segment: SegmentModel,
  centre: number,
  membraneTop: number,
  membraneBottom: number,
): Point[] {
  const count = segment.end - segment.start + 1
  const down = segment.entrySide === "outside"
  const entry = down ? membraneTop : membraneBottom
  return returnsToItsFace(segment)
    ? reentrantPoints(count, centre, entry, down)
    : crossingPoints(count, centre, entry, down)
}

export function segmentReach(segment: SegmentModel): number {
  const count = segment.end - segment.start + 1
  if (returnsToItsFace(segment)) return halfWidth(reentrantColumns(count))
  return halfWidth(Math.max(...shareOut(count, crossingRows(count))))
}

export function segmentEnds(segment: SegmentModel): { entry: number; exit: number } {
  const count = segment.end - segment.start + 1
  if (returnsToItsFace(segment)) {
    const reach = halfWidth(reentrantColumns(count))
    return { entry: reach, exit: reach }
  }
  const rows = shareOut(count, crossingRows(count))
  return { entry: halfWidth(rows[0]), exit: halfWidth(rows[rows.length - 1]) }
}
