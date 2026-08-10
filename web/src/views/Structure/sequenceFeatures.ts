// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ProteinFeature } from "@/types/structure"

export type MarkKind = "glycosylation" | "disulfide_bond"

export interface FeatureMark {
  key: string
  kind: MarkKind
  start: number
  end: number
  name: string
  description: string | null
}

export interface SignalPeptide {
  key: string
  start: number
  end: number
  residues: number
}

const MARK_KINDS = new Set<string>(["glycosylation", "disulfide_bond"])

// Disulfide bonds arrive as separate cysteine marks without pairing information
const MARK_NAMES: Record<MarkKind, string> = {
  glycosylation: "Glycosylation",
  disulfide_bond: "Disulfide cysteine",
}

export const markName = (kind: MarkKind) => MARK_NAMES[kind]

const isMark = (f: ProteinFeature): f is ProteinFeature & { feature_type: MarkKind } =>
  MARK_KINDS.has(f.feature_type)

export function featureMarks(features: ProteinFeature[]): FeatureMark[] {
  return features
    .filter(isMark)
    .sort((a, b) => a.start - b.start)
    .map((f, index) => ({
      key: [f.feature_type, f.start, f.end, index].join("-"),
      kind: f.feature_type,
      start: f.start,
      end: f.end,
      name: MARK_NAMES[f.feature_type],
      description: f.description,
    }))
}

export function signalPeptide(features: ProteinFeature[]): SignalPeptide | null {
  const signal = features.find((f) => f.feature_type === "signal_peptide")
  if (!signal) return null
  return {
    key: `signal-${signal.start}`,
    start: signal.start,
    end: signal.end,
    residues: signal.end - signal.start + 1,
  }
}

export function countMarks(marks: FeatureMark[]): { kind: MarkKind; count: number }[] {
  const counts = new Map<MarkKind, number>()
  for (const mark of marks) counts.set(mark.kind, (counts.get(mark.kind) ?? 0) + 1)
  return [...counts].map(([kind, count]) => ({ kind, count }))
}
