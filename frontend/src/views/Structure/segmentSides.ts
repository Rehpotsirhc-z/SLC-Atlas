// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ProteinFeature } from "@/types/structure"
import { opposite, type Side } from "./membraneSides"

export type SegmentKind = "transmembrane" | "intramembrane"

export interface MembraneSegment {
  start: number
  end: number
  kind: SegmentKind
  description: string | null
}

export interface ChainGap {
  start: number
  end: number
  side: Side
  domain: ProteinFeature | null
  unresolved: boolean
}

export interface SegmentSide {
  entry: Side
  exit: Side
  unresolved: boolean
}

export interface ChainSides {
  gaps: ChainGap[]
  segments: SegmentSide[]
  // False when nothing in the annotation fixes a face, so which way round the protein sits
  // is convention rather than evidence
  oriented: boolean
}

// A glycosylation, a disulfide or a cleaved signal peptide can only be on the non-cytoplasmic
// face, which is often the only thing that orients a protein UniProt gives no domains for
const NON_CYTOPLASMIC = new Set(["glycosylation", "disulfide_bond", "signal_peptide"])

export const isSegment = (f: ProteinFeature): f is ProteinFeature & { feature_type: SegmentKind } =>
  f.feature_type === "transmembrane" || f.feature_type === "intramembrane"

export const isOrientingEvidence = (f: ProteinFeature) => NON_CYTOPLASMIC.has(f.feature_type)

// Only a segment that crosses the bilayer changes which face the chain is on
const across = (segment: MembraneSegment, side: Side) =>
  segment.kind === "transmembrane" ? opposite(side) : side

/**
 * Assign a face to every stretch of chain between the membrane segments. A stretch that
 * contains an annotated topological domain takes its face from it; the rest are filled in
 * from the nearest annotated neighbour, crossing the segments in between. Where two
 * annotations cannot both be satisfied by that walk the stretch between them is flagged
 * rather than silently redrawn.
 */
export function resolveChainSides(
  segments: MembraneSegment[],
  domains: ProteinFeature[],
  evidence: ProteinFeature[],
  sideOf: (description: string | null) => Side | null,
  length: number,
): ChainSides {
  const count = segments.length
  const start = (i: number) => (i === 0 ? 1 : segments[i - 1].end + 1)
  const end = (i: number) => (i === count ? length : segments[i].start - 1)

  const anchors: (Side | null)[] = []
  const anchorDomains: (ProteinFeature | null)[] = []
  for (let i = 0; i <= count; i++) {
    const [from, to] = [start(i), end(i)]
    const inGap = (f: ProteinFeature) => f.start >= from && f.end <= to
    const domain = domains.find((d) => inGap(d) && sideOf(d.description) !== null) ?? null
    const evidenced = evidence.some(inGap) ? "outside" : null
    anchors.push(domain ? sideOf(domain.description) : evidenced)
    anchorDomains.push(domain)
  }

  const sides = [...anchors]
  const firstAnchor = sides.findIndex((side) => side !== null)
  if (firstAnchor === -1) {
    sides[0] = "inside"
  } else {
    for (let i = firstAnchor - 1; i >= 0; i--) sides[i] = across(segments[i], sides[i + 1]!)
  }
  for (let i = Math.max(firstAnchor, 0) + 1; i <= count; i++) {
    if (sides[i] === null) sides[i] = across(segments[i - 1], sides[i - 1]!)
  }

  const openGaps = new Array<boolean>(count + 1).fill(false)
  const openSegments = new Array<boolean>(count).fill(false)
  let previous = Math.max(firstAnchor, 0)
  for (let i = previous + 1; i <= count; i++) {
    if (anchors[i] === null) continue
    let predicted = sides[previous]!
    for (let s = previous; s < i; s++) predicted = across(segments[s], predicted)
    if (predicted !== anchors[i]) {
      for (let s = previous; s < i; s++) openSegments[s] = true
      for (let g = previous + 1; g < i; g++) openGaps[g] = true
    }
    previous = i
  }

  return {
    gaps: sides.map((side, i) => ({
      start: start(i),
      end: end(i),
      side: side!,
      domain: anchorDomains[i],
      unresolved: openGaps[i],
    })),
    segments: segments.map((_, i) => ({
      entry: sides[i]!,
      exit: sides[i + 1]!,
      unresolved: openSegments[i],
    })),
    oriented: firstAnchor !== -1,
  }
}
