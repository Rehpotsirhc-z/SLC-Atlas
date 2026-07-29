// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { mergeSpans, spansOverlap } from "./bindingSites"
import type { ChainArc, MembraneCylinder, PlacedSite, TopologyLayout } from "./topologyLayout"
import type { ResidueSpan } from "./molstar/types"

export type TopologyTarget =
  | { kind: "segment"; item: MembraneCylinder }
  | { kind: "arc"; item: ChainArc }
  | { kind: "site"; item: PlacedSite }
  | { kind: "confidence"; residue: number; score: number }

export interface TargetSets {
  segments: Set<string>
  arcs: Set<string>
  sites: Set<string>
  size: number
}

export const targetKey = (target: TopologyTarget | null): string | null =>
  !target
    ? null
    : target.kind === "confidence"
      ? `confidence:${target.residue}`
      : `${target.kind}:${target.item.key}`

/** The residues the target itself covers, before anything is drawn in around it. */
export function spansOf(target: TopologyTarget): ResidueSpan[] {
  if (target.kind === "site") return target.item.spans
  if (target.kind === "confidence") return [{ start: target.residue, end: target.residue }]
  return [{ start: target.item.start, end: target.item.end }]
}

/**
 * Everything that belongs with the target: a site pulls in the chain it touches, a piece of
 * chain pulls in the sites that touch it. Hover and selection both go through here, so the
 * two cannot come to disagree about what a click means.
 */
export function relatedTo(layout: TopologyLayout, target: TopologyTarget | null): TargetSets {
  const segments = new Set<string>()
  const arcs = new Set<string>()
  const sites = new Set<string>()

  if (target?.kind === "site") {
    sites.add(target.item.key)
    const { spans } = target.item
    for (const c of layout.cylinders) {
      if (spansOverlap(spans, c.start, c.end)) segments.add(c.key)
    }
    for (const arc of layout.arcs) {
      if (arc.residues && spansOverlap(spans, arc.start, arc.end)) arcs.add(arc.key)
    }
  } else if (target?.kind === "segment" || target?.kind === "arc") {
    const { start, end } = target.item
    if (target.kind === "segment") segments.add(target.item.key)
    else arcs.add(target.item.key)
    for (const site of layout.sites) {
      if (spansOverlap(site.spans, start, end)) sites.add(site.key)
    }
  }

  return { segments, arcs, sites, size: segments.size + arcs.size + sites.size }
}

export function spansForSets(layout: TopologyLayout, sets: TargetSets): ResidueSpan[] {
  const spans: ResidueSpan[] = []
  for (const c of layout.cylinders) if (sets.segments.has(c.key)) spans.push(c)
  for (const a of layout.arcs) if (sets.arcs.has(a.key)) spans.push(a)
  for (const s of layout.sites) if (sets.sites.has(s.key)) spans.push(...s.spans)
  return mergeSpans(spans)
}

/**
 * Which piece of chain a residue belongs to. Sites are left out on purpose: every residue
 * falls in exactly one cylinder or arc, and relatedTo lights the sites from there.
 */
export function targetAtResidue(layout: TopologyLayout, residue: number): TopologyTarget | null {
  const cylinder = layout.cylinders.find((c) => residue >= c.start && residue <= c.end)
  if (cylinder) return { kind: "segment", item: cylinder }
  const arc = layout.arcs.find((a) => a.residues && residue >= a.start && residue <= a.end)
  return arc ? { kind: "arc", item: arc } : null
}
