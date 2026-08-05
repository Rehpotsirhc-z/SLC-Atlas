// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ChainModel, GapModel, SegmentModel } from "./chainModel"
import { SNAKE, SNAKE_BAND, TRACK } from "./constants"
import { laneLabel, type LaneLabel, type Side } from "./membraneSides"
import { segmentEnds, segmentPoints, segmentReach } from "./snakeCoils"
import { EMPTY_GRID, indexBeads, type BeadGrid } from "./snakeHitTest"
import { chainPath, loopGuide, sizeLoop, spread } from "./snakeLoops"
import type { Point } from "./topologyLayout"

export interface Bead {
  residue: number
  x: number
  y: number
  letter: string | null
  score: number | null
  ligandIndex: number | null
}

export interface SnakeElement {
  key: string
  start: number
  end: number
  unresolved: boolean
  label: string | null
  labelX: number
  labelAnchor: "start" | "end"
  beads: Bead[]
  chain: string
}

export interface SnakeLayout {
  width: number
  height: number
  length: number
  plotLeft: number
  plotRight: number
  membraneTop: number
  membraneBottom: number
  labelY: number
  lanes: LaneLabel[]
  elements: SnakeElement[]
  termini: { label: "N" | "C"; x: number; y: number }[]
  hits: BeadGrid
  hasConfidence: boolean
}

export const EMPTY_SNAKE: SnakeLayout = {
  width: 0,
  height: 0,
  length: 0,
  plotLeft: 0,
  plotRight: 0,
  membraneTop: 0,
  membraneBottom: 0,
  labelY: 0,
  lanes: [],
  elements: [],
  termini: [],
  hits: EMPTY_GRID,
  hasConfidence: false,
}

function placeLabel(label: string, centre: number, reach: number, before: number, after: number) {
  const inset = reach + SNAKE.bead + SNAKE.segmentLabelGap
  const needed = label.length * SNAKE.segmentLabelSize * TRACK.labelAspect + SNAKE.segmentLabelGap
  if (after >= needed) return { label, labelX: centre + inset, labelAnchor: "start" as const }
  if (before >= needed) return { label, labelX: centre - inset, labelAnchor: "end" as const }
  return { label: null, labelX: centre, labelAnchor: "start" as const }
}

function ligandIndexByResidue(model: ChainModel): Map<number, number> {
  const byResidue = new Map<number, number>()
  for (const site of model.sites) {
    const index = model.ligands.findIndex((l) => l.name === site.ligand)
    for (const span of site.spans) {
      for (let r = span.start; r <= span.end; r++) byResidue.set(r, index)
    }
  }
  return byResidue
}

export function layoutSnake(
  model: ChainModel,
  plddt: number[] | null,
  sequence: string | null,
): SnakeLayout {
  const { length, segments, gaps } = model
  if (!segments.length) return EMPTY_SNAKE

  const aligned = sequence?.length === length ? sequence : null
  const confidence = plddt?.length === length ? plddt : null
  const ligands = ligandIndexByResidue(model)

  const sizes = gaps.map((gap) => sizeLoop(gap.residues, gap.terminus !== null))
  const reaches = segments.map(segmentReach)

  const deepest = (side: Side) => {
    const depths = sizes.filter((_, i) => gaps[i].side === side).map((size) => size.depth)
    return Math.max(SNAKE.minBow, ...depths) + SNAKE.bead + SNAKE.padY
  }

  const outsideLane = deepest("outside")
  const insideLane = deepest("inside")
  const membraneTop = outsideLane
  const membraneBottom = membraneTop + SNAKE_BAND
  const edgeY = (side: Side) => (side === "outside" ? membraneTop : membraneBottom)

  const ends = segments.map(segmentEnds)
  const plotLeft = SNAKE.gutter + SNAKE.padX
  const centres: number[] = []
  let x = plotLeft + sizes[0].foot + ends[0].entry
  for (let i = 0; i < segments.length; i++) {
    centres.push(x)
    if (i + 1 < segments.length) x += ends[i].exit + sizes[i + 1].foot + ends[i + 1].entry
  }
  const lastIndex = segments.length - 1
  const plotRight = centres[lastIndex] + ends[lastIndex].exit + sizes[gaps.length - 1].foot

  const beadFor = (residue: number, point: Point): Bead => ({
    residue,
    x: point.x,
    y: point.y,
    letter: aligned ? aligned[residue - 1] : null,
    score: confidence ? confidence[residue - 1] : null,
    ligandIndex: ligands.get(residue) ?? null,
  })

  const coils = segments.map((segment, i) =>
    segmentPoints(segment, centres[i], membraneTop, membraneBottom).map((point, k) =>
      beadFor(segment.start + k, point),
    ),
  )

  const exitOf = (i: number, side: Side): Point => ({
    x: centres[i] + ends[i].exit,
    y: edgeY(side),
  })
  const entryOf = (i: number, side: Side): Point => ({
    x: centres[i] - ends[i].entry,
    y: edgeY(side),
  })

  const loops = gaps.map((gap, i) => {
    if (!gap.residues) return []
    const size = sizes[i]

    if (gap.terminus === "N") {
      const guide = loopGuide(entryOf(0, gap.side), null, gap.side, size, -size.run)
      return spread(guide, gap.residues)
        .map((point, k) => beadFor(gap.end - k, point))
        .reverse()
    }

    const from = exitOf(i - 1, gap.side)
    const to = gap.terminus === "C" ? null : entryOf(i, gap.side)
    const guide = loopGuide(from, to, gap.side, size, size.run)
    return spread(guide, gap.residues).map((point, k) => beadFor(gap.start + k, point))
  })

  const NO_LABEL = { label: null, labelX: 0, labelAnchor: "start" as const }

  const ordered: { item: GapModel | SegmentModel; beads: Bead[]; index: number | null }[] = []
  gaps.forEach((gap, i) => {
    ordered.push({ item: gap, beads: loops[i], index: null })
    if (i < segments.length) ordered.push({ item: segments[i], beads: coils[i], index: i })
  })

  const elements: SnakeElement[] = ordered.map((entry, i) => {
    const next = ordered.slice(i + 1).find((e) => e.beads.length)?.beads[0]
    const through = next ? [...entry.beads, next] : entry.beads
    const column = entry.index
    return {
      key: entry.item.key,
      start: entry.item.start,
      end: entry.item.end,
      unresolved: entry.item.unresolved,
      ...(column === null
        ? NO_LABEL
        : placeLabel(
            (entry.item as SegmentModel).label,
            centres[column],
            reaches[column],
            sizes[column].foot,
            sizes[column + 1].foot,
          )),
      beads: entry.beads,
      chain: chainPath(through),
    }
  })

  const withBeads = elements.filter((e) => e.beads.length)
  const first = withBeads[0]?.beads[0]
  const lastBeads = withBeads[withBeads.length - 1]?.beads
  const last = lastBeads?.[lastBeads.length - 1]

  return {
    width: plotRight + SNAKE.padX,
    height: membraneBottom + insideLane,
    length,
    plotLeft,
    plotRight,
    membraneTop,
    membraneBottom,
    labelY: (membraneTop + membraneBottom) / 2,
    lanes: [
      { key: "outside", label: laneLabel(model.sideLabels.outside), y: outsideLane / 2 },
      { key: "membrane", label: "Membrane", y: (membraneTop + membraneBottom) / 2 },
      {
        key: "inside",
        label: laneLabel(model.sideLabels.inside),
        y: membraneBottom + insideLane / 2,
      },
    ],
    elements,
    termini: [
      ...(first ? [{ label: "N" as const, x: first.x, y: first.y }] : []),
      ...(last ? [{ label: "C" as const, x: last.x, y: last.y }] : []),
    ],
    hits: indexBeads(elements.flatMap((element) => element.beads)),
    hasConfidence: confidence !== null,
  }
}
