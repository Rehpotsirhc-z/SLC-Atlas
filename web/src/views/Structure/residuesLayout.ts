// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { segmentEnds, segmentPoints } from "./beadCoils"
import { EMPTY_GRID, indexBeads, type BeadGrid } from "./beadHitTest"
import { chainPath, loopGuide, sizeLoop, spread } from "./beadLoops"
import type { ChainModel, GapModel, SegmentModel } from "./chainModel"
import { RESIDUES, RESIDUES_BAND, TRACK } from "./constants"
import { laneLabel, type LaneLabel, type Side } from "./membraneSides"
import type { Point } from "./regionsLayout"

const textWidth = (label: string, size: number) => label.length * size * TRACK.labelAspect
const beadInk = RESIDUES.bead + RESIDUES.litRing / 2

export interface Bead {
  residue: number
  x: number
  y: number
  letter: string | null
  score: number | null
  ligandIndex: number | null
}

export interface BeadElement {
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

interface Terminus {
  label: "N" | "C"
  x: number
  y: number
}

export interface ResiduesLayout {
  width: number
  height: number
  length: number
  plotLeft: number
  plotRight: number
  membraneTop: number
  membraneBottom: number
  labelY: number
  lanes: LaneLabel[]
  elements: BeadElement[]
  termini: Terminus[]
  hits: BeadGrid
  hasConfidence: boolean
}

export const EMPTY_RESIDUES: ResiduesLayout = {
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

export function beadAt(
  layout: ResiduesLayout,
  residue: number | null,
): { bead: Bead; element: BeadElement } | null {
  if (residue === null) return null
  for (const element of layout.elements) {
    if (residue < element.start || residue > element.end) continue
    const bead = element.beads.find((candidate) => candidate.residue === residue)
    if (bead) return { bead, element }
  }
  return null
}

function labelReach(beads: Bead[], centre: number, labelY: number) {
  const off = (bead: Bead) => Math.abs(bead.y - labelY)
  const nearest = Math.min(...beads.map(off))
  const row = beads.filter((bead) => off(bead) < nearest + RESIDUES.spacing / 2)
  return {
    left: centre - Math.min(...row.map((bead) => bead.x)),
    right: Math.max(...row.map((bead) => bead.x)) - centre,
  }
}

function placeLabel(
  label: string,
  centre: number,
  reach: { left: number; right: number },
  before: number,
  after: number,
) {
  const inset = (side: number) => side + RESIDUES.bead + RESIDUES.segmentLabelGap
  const needed = textWidth(label, RESIDUES.segmentLabelSize) + RESIDUES.segmentLabelGap
  if (after >= needed) {
    return { label, labelX: centre + inset(reach.right), labelAnchor: "start" as const }
  }
  if (before >= needed) {
    return { label, labelX: centre - inset(reach.left), labelAnchor: "end" as const }
  }
  return { label: null, labelX: centre, labelAnchor: "start" as const }
}

function inkedRight(elements: BeadElement[], termini: Terminus[]): number {
  let edge = 0
  for (const element of elements) {
    for (const bead of element.beads) edge = Math.max(edge, bead.x + beadInk)
    if (element.label !== null) {
      const runs =
        element.labelAnchor === "start" ? textWidth(element.label, RESIDUES.segmentLabelSize) : 0
      edge = Math.max(edge, element.labelX + runs)
    }
  }
  for (const terminus of termini) {
    if (terminus.label !== "C") continue
    const half = textWidth(terminus.label, RESIDUES.terminusSize) / 2
    edge = Math.max(edge, terminus.x + RESIDUES.bead + RESIDUES.terminusGap + half)
  }
  return edge
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

export function layoutResidues(
  model: ChainModel,
  plddt: number[] | null,
  sequence: string | null,
): ResiduesLayout {
  const { length, segments, gaps } = model
  if (!segments.length) return EMPTY_RESIDUES

  const aligned = sequence?.length === length ? sequence : null
  const confidence = plddt?.length === length ? plddt : null
  const ligands = ligandIndexByResidue(model)

  const sizes = gaps.map((gap) => sizeLoop(gap.residues, gap.terminus !== null))

  const deepest = (side: Side) => {
    const depths = sizes.filter((_, i) => gaps[i].side === side).map((size) => size.depth)
    return Math.max(RESIDUES.minBow, ...depths) + RESIDUES.bead + RESIDUES.padY
  }

  const outsideLane = deepest("outside")
  const insideLane = deepest("inside")
  const membraneTop = outsideLane
  const membraneBottom = membraneTop + RESIDUES_BAND
  const labelY = (membraneTop + membraneBottom) / 2
  const edgeY = (side: Side) => (side === "outside" ? membraneTop : membraneBottom)

  const ends = segments.map(segmentEnds)
  const plotLeft = RESIDUES.gutter + RESIDUES.padX
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

  const reaches = coils.map((beads, i) => labelReach(beads, centres[i], labelY))

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

  const runBetween = (from: number, to: number) =>
    to - from - 2 * RESIDUES.bead - RESIDUES.segmentLabelGap
  const roomBefore = (i: number) =>
    i === 0
      ? sizes[i].foot
      : runBetween(centres[i - 1] + reaches[i - 1].right, centres[i] - reaches[i].left)
  const roomAfter = (i: number) =>
    i + 1 < segments.length
      ? runBetween(centres[i] + reaches[i].right, centres[i + 1] - reaches[i + 1].left)
      : sizes[i + 1].foot

  const ordered: { item: GapModel | SegmentModel; beads: Bead[]; index: number | null }[] = []
  gaps.forEach((gap, i) => {
    ordered.push({ item: gap, beads: loops[i], index: null })
    if (i < segments.length) ordered.push({ item: segments[i], beads: coils[i], index: i })
  })

  const elements: BeadElement[] = ordered.map((entry, i) => {
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
            roomBefore(column),
            roomAfter(column),
          )),
      beads: entry.beads,
      chain: chainPath(through),
    }
  })

  const withBeads = elements.filter((e) => e.beads.length)
  const first = withBeads[0]?.beads[0]
  const lastBeads = withBeads[withBeads.length - 1]?.beads
  const last = lastBeads?.[lastBeads.length - 1]

  const termini: Terminus[] = [
    ...(first ? [{ label: "N" as const, x: first.x, y: first.y }] : []),
    ...(last ? [{ label: "C" as const, x: last.x, y: last.y }] : []),
  ]

  return {
    width: Math.max(plotRight, inkedRight(elements, termini)) + RESIDUES.padX,
    height: membraneBottom + insideLane,
    length,
    plotLeft,
    plotRight,
    membraneTop,
    membraneBottom,
    labelY,
    lanes: [
      { key: "outside", label: laneLabel(model.sideLabels.outside), y: outsideLane / 2 },
      { key: "membrane", label: "Membrane", y: labelY },
      {
        key: "inside",
        label: laneLabel(model.sideLabels.inside),
        y: membraneBottom + insideLane / 2,
      },
    ],
    elements,
    termini,
    hits: indexBeads(elements.flatMap((element) => element.beads)),
    hasConfidence: confidence !== null,
  }
}
