// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ChainModel, GapModel, SegmentModel } from "./chainModel"
import { confidenceBars, type ConfidenceBar } from "./confidenceBars"
import { TRACK } from "./constants"
import { laneLabel, type LaneLabel, type Side } from "./membraneSides"
import { residueAxis, type AxisTick, type Window } from "./residueAxis"
import { placeSites, type PlacedSite } from "./siteLane"

export interface Point {
  x: number
  y: number
}

export interface MembraneCylinder extends SegmentModel {
  x: number
  width: number
  top: number
  bottom: number
  // The pill's own extent; a rounded end pokes past the membrane only where the segment
  // actually reaches that face
  drawTop: number
  drawBottom: number
  cap: number
  // Font size the label fits at, or null where the pill is too narrow for it to be read
  labelSize: number | null
}

export interface ChainArc extends GapModel {
  path: string
}

export interface RegionsLayout {
  width: number
  height: number
  length: number
  plotLeft: number
  plotRight: number
  membraneTop: number
  membraneBottom: number
  axisY: number
  axisLabelY: number
  bindsTop: number
  bindsHeight: number
  confidenceTop: number
  confidenceHeight: number
  lanes: LaneLabel[]
  cylinders: MembraneCylinder[]
  arcs: ChainArc[]
  sites: PlacedSite[]
  confidence: ConfidenceBar[]
  ticks: AxisTick[]
  termini: { label: "N" | "C"; x: number; y: number }[]
}

export const EMPTY_REGIONS: RegionsLayout = {
  width: 0,
  height: 0,
  length: 0,
  plotLeft: 0,
  plotRight: 0,
  membraneTop: 0,
  membraneBottom: 0,
  axisY: 0,
  axisLabelY: 0,
  bindsTop: 0,
  bindsHeight: 0,
  confidenceTop: 0,
  confidenceHeight: 0,
  lanes: [],
  cylinders: [],
  arcs: [],
  sites: [],
  confidence: [],
  ticks: [],
  termini: [],
}

export const capRadius = (width: number, height: number) =>
  Math.min(width / 2, height / 2, TRACK.capRadius)

function capJoin(cylinder: MembraneCylinder, side: Side, x: number): number {
  const edge = side === "outside" ? cylinder.drawTop : cylinder.drawBottom
  const centre = side === "outside" ? edge + cylinder.cap : edge - cylinder.cap
  const flatFrom = cylinder.x + cylinder.cap
  const flatTo = cylinder.x + cylinder.width - cylinder.cap
  const dx = x < flatFrom ? flatFrom - x : x > flatTo ? x - flatTo : 0
  const reach = Math.sqrt(Math.max(cylinder.cap ** 2 - dx ** 2, 0))
  return side === "outside" ? centre - reach : centre + reach
}

function labelSizeFor(label: string, width: number): number | null {
  const room = width - TRACK.pillGap
  const fits = room / (label.length * TRACK.labelAspect)
  const size = Math.floor(Math.min(TRACK.labelSize, fits) * 2) / 2
  return size >= TRACK.minLabelSize ? size : null
}

export function layoutRegions(
  model: ChainModel,
  width: number,
  plddt: number[] | null,
): RegionsLayout {
  const { length, segments, gaps, sites } = model
  const axis = residueAxis(length, width)
  const { plotLeft, plotRight, perResidue, toX, boxFor, ticks } = axis

  const membraneTop = TRACK.outsideLane
  const membraneBottom = membraneTop + TRACK.membraneHeight
  const membraneMid = (membraneTop + membraneBottom) / 2
  const insideBottom = membraneBottom + TRACK.insideLane
  const edgeY = (side: Side) => (side === "outside" ? membraneTop : membraneBottom)

  const bindsTop = insideBottom + (sites.length ? TRACK.laneGap : 0)
  const bindsHeight = sites.length * TRACK.siteRow
  const confidence = confidenceBars(plddt, length)
  const confidenceTop = bindsTop + bindsHeight + (confidence.length ? TRACK.laneGap : 0)
  const confidenceHeight = confidence.length ? TRACK.confidenceLane : 0
  const axisY = confidenceTop + confidenceHeight + TRACK.axisGap

  const edges = segments.map((segment, i) =>
    i === 0
      ? Number.NEGATIVE_INFINITY
      : (toX(segments[i - 1].end) + perResidue + toX(segment.start)) / 2,
  )
  const pillWindow = (i: number): Window => {
    const from = edges[i]
    const to = i + 1 < edges.length ? edges[i + 1] : Number.POSITIVE_INFINITY
    const give = Math.min(TRACK.pillGap, (to - from) / 2)
    return { from: from + give / 2, to: to - give / 2 }
  }

  const cylinders: MembraneCylinder[] = segments.map((segment, i) => {
    const crosses = segment.kind === "transmembrane"
    const box = boxFor(segment.start, segment.end, TRACK.helixMinWidth, pillWindow(i))
    const top = !crosses && segment.entrySide === "inside" ? membraneMid : membraneTop
    const bottom = !crosses && segment.entrySide === "outside" ? membraneMid : membraneBottom
    const cap = capRadius(box.width, bottom - top)
    return {
      ...segment,
      ...box,
      top,
      bottom,
      drawTop: top === membraneTop ? top - cap : top,
      drawBottom: bottom === membraneBottom ? bottom + cap : bottom,
      cap,
      labelSize: labelSizeFor(segment.label, box.width),
    }
  })

  // A segment the chain leaves on the side it entered has both loops on one face, so they
  // attach either side of its midline instead of meeting at a single point
  const joins = cylinders.map((c) => {
    const oneSided = c.entrySide === c.exitSide
    const join = (side: Side, fraction: number) => {
      const x = c.x + c.width * fraction
      return { x, y: capJoin(c, side, x) }
    }
    return {
      entry: join(c.entrySide, oneSided ? TRACK.oneSidedJoin : 0.5),
      exit: join(c.exitSide, oneSided ? 1 - TRACK.oneSidedJoin : 0.5),
    }
  })

  const laneHeight = (side: Side) => (side === "outside" ? TRACK.outsideLane : TRACK.insideLane)
  const arcs: ChainArc[] = gaps.map((gap, i) => {
    const from = i === 0 ? { x: toX(1), y: edgeY(gap.side) } : joins[i - 1].exit
    const to = i === segments.length ? { x: toX(length), y: edgeY(gap.side) } : joins[i].entry
    const reach = Math.min(
      TRACK.minArc + gap.residues * TRACK.arcPerResidue,
      laneHeight(gap.side) - TRACK.laneGap - TRACK.capRadius,
    )
    // Measure the bulge from whichever cap sticks out furthest, so the curve clears both
    const baseY = gap.side === "outside" ? Math.min(from.y, to.y) : Math.max(from.y, to.y)
    const control = {
      x: (from.x + to.x) / 2,
      y: baseY + (gap.side === "outside" ? -1 : 1) * 2 * reach,
    }
    return {
      ...gap,
      path: gap.residues
        ? `M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`
        : `M${from.x} ${from.y} L${to.x} ${to.y}`,
    }
  })

  const placed = placeSites(sites, model.ligands, axis, bindsTop)

  const first = arcs[0]
  const last = arcs[arcs.length - 1]
  const termini: RegionsLayout["termini"] = [
    { label: "N", ...(first.residues ? { x: toX(1), y: edgeY(first.side) } : joins[0].entry) },
    {
      label: "C",
      ...(last.residues ? { x: toX(length), y: edgeY(last.side) } : joins[joins.length - 1].exit),
    },
  ]

  const lanes: LaneLabel[] = [
    {
      key: "outside",
      label: laneLabel(model.sideLabels.outside),
      y: membraneTop - TRACK.outsideLane / 2,
    },
    { key: "membrane", label: "Membrane", y: membraneMid },
    {
      key: "inside",
      label: laneLabel(model.sideLabels.inside),
      y: membraneBottom + TRACK.insideLane / 2,
    },
  ]
  if (sites.length) lanes.push({ key: "binds", label: "Binds", y: bindsTop + bindsHeight / 2 })
  if (confidence.length) {
    lanes.push({ key: "confidence", label: "Confidence", y: confidenceTop + confidenceHeight / 2 })
  }

  return {
    // Short proteins do not fill the pane, so the figure ends where the axis does
    width: plotRight + TRACK.padRight,
    height: axisY + TRACK.axisLabels,
    length,
    plotLeft,
    plotRight,
    membraneTop,
    membraneBottom,
    axisY,
    axisLabelY: axisY + 14,
    bindsTop,
    bindsHeight,
    confidenceTop,
    confidenceHeight,
    lanes,
    cylinders,
    arcs,
    sites: placed,
    confidence,
    ticks,
    termini,
  }
}
