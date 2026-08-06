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
import { membraneFaces, type Side } from "./membraneSides"
import {
  isOrientingEvidence,
  isSegment,
  resolveChainSides,
  type MembraneSegment,
  type SegmentKind,
} from "./segmentSides"

export interface SegmentModel {
  key: string
  kind: SegmentKind
  label: string
  name: string
  start: number
  end: number
  description: string | null
  entrySide: Side
  exitSide: Side
  unresolved: boolean
}

export interface GapModel {
  key: string
  side: Side
  start: number
  end: number
  residues: number
  description: string | null
  unresolved: boolean
  terminus: "N" | "C" | null
}

export interface SiteModel extends BindingSite {
  elements: string[]
}

export interface ChainModel {
  length: number
  segments: SegmentModel[]
  gaps: GapModel[]
  sites: SiteModel[]
  ligands: LigandTotal[]
  sideLabels: Record<Side, string>
  membrane: string | null
  oriented: boolean
  unresolved: ResidueSpan[]
}

export const EMPTY_MODEL: ChainModel = {
  length: 0,
  segments: [],
  gaps: [],
  sites: [],
  ligands: [],
  sideLabels: { inside: "", outside: "" },
  membrane: null,
  oriented: false,
  unresolved: [],
}

const uniprotName = (description: string | null) => /Name=([^;]+)/.exec(description ?? "")?.[1]

export function buildChainModel(features: ProteinFeature[], length: number): ChainModel {
  const domains = features
    .filter((f) => f.feature_type === "topological_domain")
    .sort((a, b) => a.start - b.start)
  const evidence = features.filter(isOrientingEvidence)
  const faces = membraneFaces(domains)

  const raw: MembraneSegment[] = features
    .filter(isSegment)
    .sort((a, b) => a.start - b.start)
    .map((f) => ({
      start: f.start,
      end: f.end,
      kind: f.feature_type,
      description: f.description,
    }))
  const chain = resolveChainSides(raw, domains, evidence, faces.sideOf, length)

  let helices = 0
  let reentrant = 0
  const segments: SegmentModel[] = raw.map((segment, i) => {
    const crosses = segment.kind === "transmembrane"
    const { entry, exit, unresolved } = chain.segments[i]
    const label = crosses
      ? `${++helices}`
      : (uniprotName(segment.description) ?? `IM${++reentrant}`)
    return {
      key: `${segment.kind}-${segment.start}`,
      kind: segment.kind,
      label,
      name: crosses ? `Transmembrane helix ${label}` : `Intramembrane segment ${label}`,
      start: segment.start,
      end: segment.end,
      description: segment.description,
      entrySide: entry,
      exitSide: exit,
      unresolved,
    }
  })

  const gaps: GapModel[] = chain.gaps.map((gap, i) => ({
    key: `gap-${gap.start}`,
    side: gap.side,
    start: gap.start,
    end: gap.end,
    residues: Math.max(gap.end - gap.start + 1, 0),
    description: gap.domain?.description ?? null,
    unresolved: gap.unresolved,
    terminus: i === 0 ? "N" : i === raw.length ? "C" : null,
  }))

  const elementsFor = (spans: ResidueSpan[]) => {
    const labels = segments
      .filter((s) => spansOverlap(spans, s.start, s.end))
      .map((s) => (s.kind === "transmembrane" ? `TM${s.label}` : s.label))
    for (const gap of gaps) {
      if (!gap.residues || !spansOverlap(spans, gap.start, gap.end)) continue
      labels.push(gap.terminus ? `the ${gap.terminus}-terminus` : (gap.description ?? "a loop"))
    }
    return [...new Set(labels)]
  }

  const raws = bindingSites(features)
  const sites: SiteModel[] = raws.map((site) => ({ ...site, elements: elementsFor(site.spans) }))

  return {
    length,
    segments,
    gaps,
    sites,
    ligands: ligandTotals(raws),
    sideLabels: faces.labels,
    membrane: faces.membrane,
    oriented: chain.oriented,
    unresolved: mergeSpans([
      ...segments.filter((s) => s.unresolved).map((s) => ({ start: s.start, end: s.end })),
      ...gaps
        .filter((g) => g.unresolved && g.residues)
        .map((g) => ({ start: g.start, end: g.end })),
    ]),
  }
}

export function elementAtResidue(
  model: ChainModel,
  residue: number,
): SegmentModel | GapModel | null {
  const segment = model.segments.find((s) => residue >= s.start && residue <= s.end)
  if (segment) return segment
  return model.gaps.find((g) => g.residues && residue >= g.start && residue <= g.end) ?? null
}

export const isSegmentModel = (element: SegmentModel | GapModel): element is SegmentModel =>
  "kind" in element
