// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { mergeSpans, spansOverlap } from "./bindingSites"
import { elementAtResidue, isSegmentModel } from "./chainModel"
import type { ChainModel, GapModel, SegmentModel, SiteModel } from "./chainModel"
import type { ResidueSpan } from "./molstar/types"

export type TopologyTarget =
  | { kind: "segment"; item: SegmentModel }
  | { kind: "arc"; item: GapModel }
  | { kind: "site"; item: SiteModel }
  | { kind: "confidence"; residue: number; score: number }
  // One bead: what the residues plot knows about a residue on its own
  | { kind: "residue"; residue: number; letter: string | null; score: number | null }

export interface TargetSets {
  segments: Set<string>
  arcs: Set<string>
  sites: Set<string>
  // The one bead the pointer is on, which only the residues plot can draw
  residue: number | null
  size: number
}

export const residueTarget = (residue: number): TopologyTarget => ({
  kind: "residue",
  residue,
  letter: null,
  score: null,
})

export const targetKey = (target: TopologyTarget | null): string | null =>
  !target
    ? null
    : target.kind === "confidence" || target.kind === "residue"
      ? `${target.kind}:${target.residue}`
      : `${target.kind}:${target.item.key}`

export function spansOf(target: TopologyTarget): ResidueSpan[] {
  if (target.kind === "site") return target.item.spans
  if (target.kind === "confidence" || target.kind === "residue") {
    return [{ start: target.residue, end: target.residue }]
  }
  return [{ start: target.item.start, end: target.item.end }]
}

export function relatedTo(model: ChainModel, target: TopologyTarget | null): TargetSets {
  const segments = new Set<string>()
  const arcs = new Set<string>()
  const sites = new Set<string>()

  const pullSites = (start: number, end: number) => {
    for (const site of model.sites) {
      if (spansOverlap(site.spans, start, end)) sites.add(site.key)
    }
  }

  if (target?.kind === "site") {
    sites.add(target.item.key)
    const { spans } = target.item
    for (const s of model.segments) {
      if (spansOverlap(spans, s.start, s.end)) segments.add(s.key)
    }
    for (const gap of model.gaps) {
      if (gap.residues && spansOverlap(spans, gap.start, gap.end)) arcs.add(gap.key)
    }
  } else if (target?.kind === "segment" || target?.kind === "arc") {
    const { start, end } = target.item
    if (target.kind === "segment") segments.add(target.item.key)
    else arcs.add(target.item.key)
    pullSites(start, end)
  } else if (target?.kind === "residue") {
    pullSites(target.residue, target.residue)
  }

  const residue = target?.kind === "residue" ? target.residue : null

  return {
    segments,
    arcs,
    sites,
    residue,
    size: segments.size + arcs.size + sites.size + (residue === null ? 0 : 1),
  }
}

const NO_SPANS: ResidueSpan[] = []

export function spansForSets(model: ChainModel, sets: TargetSets): ResidueSpan[] {
  if (sets.size === 0) return NO_SPANS
  const spans: ResidueSpan[] = []
  for (const s of model.segments) if (sets.segments.has(s.key)) spans.push(s)
  for (const g of model.gaps) if (sets.arcs.has(g.key)) spans.push(g)
  for (const s of model.sites) if (sets.sites.has(s.key)) spans.push(...s.spans)
  return mergeSpans(spans)
}

export function highlightFor(model: ChainModel, target: TopologyTarget | null): ResidueSpan[] {
  if (!target) return NO_SPANS
  if (target.kind === "residue") return spansOf(target)
  return spansForSets(model, relatedTo(model, target))
}

export function targetAtResidue(model: ChainModel, residue: number): TopologyTarget | null {
  const element = elementAtResidue(model, residue)
  if (!element) return null
  return isSegmentModel(element)
    ? { kind: "segment", item: element }
    : { kind: "arc", item: element }
}
