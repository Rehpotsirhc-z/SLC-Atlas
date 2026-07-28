// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ProteinFeature } from "@/types/structure"
import {
  bindingSites,
  ligandTotals,
  mergeSpans,
  spansOverlap,
  type BindingSite,
  type LigandTotal,
  type ResidueSpan,
} from "./bindingSites"
import { confidenceBars, type ConfidenceBar } from "./confidenceBars"
import { TRACK } from "./constants"
import { laneLabel, membraneFaces, type Side } from "./membraneSides"
import {
  isOrientingEvidence,
  isSegment,
  resolveChainSides,
  type MembraneSegment,
  type SegmentKind,
} from "./segmentSides"

export interface Point {
  x: number
  y: number
}

export interface MembraneCylinder {
  key: string
  kind: SegmentKind
  label: string
  name: string
  start: number
  end: number
  description: string | null
  x: number
  width: number
  top: number
  bottom: number
  // The pill's own extent; a rounded end pokes past the membrane only where the segment
  // actually reaches that face
  drawTop: number
  drawBottom: number
  cap: number
  entrySide: Side
  exitSide: Side
  unresolved: boolean
  showLabel: boolean
}

export interface ChainArc {
  key: string
  side: Side
  start: number
  end: number
  residues: number
  path: string
  description: string | null
  unresolved: boolean
  terminus: "N" | "C" | null
}

export interface SiteBar {
  key: string
  x: number
  width: number
}

export interface PlacedSite extends BindingSite {
  bars: SiteBar[]
  connectorFrom: number
  connectorTo: number
  y: number
  // The structural elements the residues fall in, e.g. ["TM1", "TM8"]
  elements: string[]
}

export interface AxisTick {
  residue: number
  x: number
}

export interface LaneLabel {
  key: string
  label: string
  y: number
}

export interface TopologyLayout {
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
  ligands: LigandTotal[]
  confidence: ConfidenceBar[]
  ticks: AxisTick[]
  termini: { label: "N" | "C"; x: number; y: number }[]
  sideLabels: Record<Side, string>
  membrane: string | null
  oriented: boolean
  unresolved: ResidueSpan[]
}

export const EMPTY_LAYOUT: TopologyLayout = {
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
  ligands: [],
  confidence: [],
  ticks: [],
  termini: [],
  sideLabels: { inside: "", outside: "" },
  membrane: null,
  oriented: false,
  unresolved: [],
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

const uniprotName = (description: string | null) => /Name=([^;]+)/.exec(description ?? "")?.[1]

function axisTicks(length: number, toX: (residue: number) => number): AxisTick[] {
  const ticks: AxisTick[] = [{ residue: 1, x: toX(1) }]
  for (let r = TRACK.tickSpacing; r < length; r += TRACK.tickSpacing) {
    ticks.push({ residue: r, x: toX(r) })
  }
  // Drop the last regular tick when the end label would sit on top of it
  if (length - ticks[ticks.length - 1].residue < TRACK.tickSpacing / 3) ticks.pop()
  ticks.push({ residue: length, x: toX(length) })
  return ticks
}

export function layoutTopology(
  features: ProteinFeature[],
  length: number,
  width: number,
  plddt: number[] | null,
): TopologyLayout {
  const plotLeft = TRACK.gutter + TRACK.padX
  const span = Math.max(length - 1, 1)
  const inner = Math.max(width - TRACK.padRight - plotLeft, 1)
  const plotRight = plotLeft + inner
  const toX = (residue: number) => plotLeft + ((residue - 1) / span) * inner
  const perResidue = inner / span
  // A feature covers its end residue too, so its box runs one residue past that residue's tick
  const boxFor = (start: number, end: number, minimum: number) => {
    const boxWidth = Math.max(toX(end) - toX(start) + perResidue, minimum)
    return { x: (toX(start) + toX(end) + perResidue - boxWidth) / 2, width: boxWidth }
  }

  const membraneTop = TRACK.outsideLane
  const membraneBottom = membraneTop + TRACK.membraneHeight
  const membraneMid = (membraneTop + membraneBottom) / 2
  const insideBottom = membraneBottom + TRACK.insideLane
  const edgeY = (side: Side) => (side === "outside" ? membraneTop : membraneBottom)

  const domains = features
    .filter((f) => f.feature_type === "topological_domain")
    .sort((a, b) => a.start - b.start)
  const evidence = features.filter(isOrientingEvidence)
  const faces = membraneFaces(domains)

  const segments: MembraneSegment[] = features
    .filter(isSegment)
    .sort((a, b) => a.start - b.start)
    .map((f) => ({
      start: f.start,
      end: f.end,
      kind: f.feature_type,
      description: f.description,
    }))
  const chain = resolveChainSides(segments, domains, evidence, faces.sideOf, length)

  const sites = bindingSites(features)
  const bindsTop = insideBottom + (sites.length ? TRACK.laneGap : 0)
  const bindsHeight = sites.length * TRACK.siteRow
  const confidence = confidenceBars(plddt, length)
  const confidenceTop = bindsTop + bindsHeight + (confidence.length ? TRACK.laneGap : 0)
  const confidenceHeight = confidence.length ? TRACK.confidenceLane : 0
  const axisY = confidenceTop + confidenceHeight + TRACK.axisGap

  let helices = 0
  let reentrant = 0
  const cylinders: MembraneCylinder[] = segments.map((segment, i) => {
    const crosses = segment.kind === "transmembrane"
    const { entry, exit, unresolved } = chain.segments[i]
    const box = boxFor(segment.start, segment.end, TRACK.helixMinWidth)
    const label = crosses
      ? `${++helices}`
      : (uniprotName(segment.description) ?? `IM${++reentrant}`)
    const top = !crosses && entry === "inside" ? membraneMid : membraneTop
    const bottom = !crosses && entry === "outside" ? membraneMid : membraneBottom
    const cap = capRadius(box.width, bottom - top)
    return {
      key: `${segment.kind}-${segment.start}`,
      kind: segment.kind,
      label,
      name: crosses ? `Transmembrane helix ${label}` : `Intramembrane segment ${label}`,
      start: segment.start,
      end: segment.end,
      description: segment.description,
      ...box,
      top,
      bottom,
      drawTop: top === membraneTop ? top - cap : top,
      drawBottom: bottom === membraneBottom ? bottom + cap : bottom,
      cap,
      entrySide: entry,
      exitSide: exit,
      unresolved,
      showLabel: box.width >= TRACK.minLabelWidth,
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
  const arcs: ChainArc[] = chain.gaps.map((gap, i) => {
    const from = i === 0 ? { x: toX(1), y: edgeY(gap.side) } : joins[i - 1].exit
    const to = i === segments.length ? { x: toX(length), y: edgeY(gap.side) } : joins[i].entry
    const residues = Math.max(gap.end - gap.start + 1, 0)
    const reach = Math.min(
      TRACK.minArc + residues * TRACK.arcPerResidue,
      laneHeight(gap.side) - TRACK.laneGap - TRACK.capRadius,
    )
    // Measure the bulge from whichever cap sticks out furthest, so the curve clears both
    const baseY = gap.side === "outside" ? Math.min(from.y, to.y) : Math.max(from.y, to.y)
    const control = {
      x: (from.x + to.x) / 2,
      y: baseY + (gap.side === "outside" ? -1 : 1) * 2 * reach,
    }
    return {
      key: `gap-${gap.start}`,
      side: gap.side,
      start: gap.start,
      end: gap.end,
      residues,
      path: residues
        ? `M${from.x} ${from.y} Q${control.x} ${control.y} ${to.x} ${to.y}`
        : `M${from.x} ${from.y} L${to.x} ${to.y}`,
      description: gap.domain?.description ?? null,
      unresolved: gap.unresolved,
      terminus: i === 0 ? "N" : i === segments.length ? "C" : null,
    }
  })

  const elementsFor = (spans: ResidueSpan[]) => {
    const labels = cylinders
      .filter((c) => spansOverlap(spans, c.start, c.end))
      .map((c) => (c.kind === "transmembrane" ? `TM${c.label}` : c.label))
    for (const arc of arcs) {
      if (!arc.residues || !spansOverlap(spans, arc.start, arc.end)) continue
      labels.push(arc.terminus ? `the ${arc.terminus}-terminus` : (arc.description ?? "a loop"))
    }
    return [...new Set(labels)]
  }

  const placed: PlacedSite[] = sites.map((site, row) => {
    const bars = site.spans.map((s) => ({
      key: `${s.start}-${s.end}`,
      ...boxFor(s.start, s.end, TRACK.siteBarMinWidth),
    }))
    const centre = (bar: SiteBar) => bar.x + bar.width / 2
    return {
      ...site,
      bars,
      connectorFrom: centre(bars[0]),
      connectorTo: centre(bars[bars.length - 1]),
      y: bindsTop + row * TRACK.siteRow + TRACK.siteRow / 2,
      elements: elementsFor(site.spans),
    }
  })

  const first = arcs[0]
  const last = arcs[arcs.length - 1]
  const termini: TopologyLayout["termini"] = [
    { label: "N", ...(first.residues ? { x: toX(1), y: edgeY(first.side) } : joins[0].entry) },
    {
      label: "C",
      ...(last.residues ? { x: toX(length), y: edgeY(last.side) } : joins[joins.length - 1].exit),
    },
  ]

  const lanes: LaneLabel[] = [
    {
      key: "outside",
      label: laneLabel(faces.labels.outside),
      y: membraneTop - TRACK.outsideLane / 2,
    },
    { key: "membrane", label: "Membrane", y: membraneMid },
    {
      key: "inside",
      label: laneLabel(faces.labels.inside),
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
    ligands: ligandTotals(sites),
    confidence,
    ticks: axisTicks(length, toX),
    termini,
    sideLabels: faces.labels,
    membrane: faces.membrane,
    oriented: chain.oriented,
    unresolved: mergeSpans([
      ...cylinders.filter((c) => c.unresolved).map((c) => ({ start: c.start, end: c.end })),
      ...arcs
        .filter((a) => a.unresolved && a.residues)
        .map((a) => ({ start: a.start, end: a.end })),
    ]),
  }
}
