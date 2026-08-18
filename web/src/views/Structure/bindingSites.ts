// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ProteinFeature } from "@/types/structure"

// A binding feature can name a single contact residue or a whole region, so a site is a set
// of intervals rather than a set of residues
export interface ResidueSpan {
  start: number
  end: number
}

export interface BindingSite {
  key: string
  ligand: string
  chebi: string | null
  // Site number within the ligand, when the protein binds more than one of it
  label: number | null
  spans: ResidueSpan[]
  residues: number
}

export interface LigandTotal {
  name: string
  chebi: string | null
  sites: number
  residues: number
}

export const isBindingFeature = (f: ProteinFeature) =>
  f.feature_type === "binding_site" || f.feature_type === "active_site"

const ligandOf = (f: ProteinFeature) =>
  f.ligand_name ?? (f.feature_type === "active_site" ? "Active site" : "Ligand")

export const siteName = (site: BindingSite) =>
  site.label ? `${site.ligand} site ${site.label}` : site.ligand

export const spanLength = (span: ResidueSpan) => span.end - span.start + 1

export const formatSpans = (spans: ResidueSpan[]) =>
  spans.map((s) => (s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`)).join(", ")

export const clipSpans = (spans: ResidueSpan[], from: number, to: number): ResidueSpan[] =>
  spans
    .filter((s) => s.end >= from && s.start <= to)
    .map((s) => ({ start: Math.max(s.start, from), end: Math.min(s.end, to) }))

export const spansOverlap = (spans: ResidueSpan[], from: number, to: number) =>
  spans.some((s) => s.end >= from && s.start <= to)

// Sort and coalesce, so touching or overlapping intervals become one.
export function mergeSpans(spans: ResidueSpan[]): ResidueSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: ResidueSpan[] = []
  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (last && span.start <= last.end + 1) last.end = Math.max(last.end, span.end)
    else merged.push({ ...span })
  }
  return merged
}

export function bindingSites(features: ProteinFeature[]): BindingSite[] {
  const grouped = new Map<string, BindingSite>()
  for (const f of features) {
    if (!isBindingFeature(f)) continue
    const ligand = ligandOf(f)
    const key = `${ligand}#${f.ligand_label ?? ""}`
    const site = grouped.get(key) ?? {
      key,
      ligand,
      chebi: f.ligand_chebi,
      label: f.ligand_label,
      spans: [],
      residues: 0,
    }
    site.spans.push({ start: f.start, end: f.end })
    grouped.set(key, site)
  }

  return [...grouped.values()]
    .map((site) => {
      const spans = mergeSpans(site.spans)
      return { ...site, spans, residues: spans.reduce((sum, s) => sum + spanLength(s), 0) }
    })
    .sort((a, b) => a.ligand.localeCompare(b.ligand) || (a.label ?? 0) - (b.label ?? 0))
}

export function ligandTotals(sites: BindingSite[]): LigandTotal[] {
  const totals = new Map<string, LigandTotal>()
  for (const site of sites) {
    const entry = totals.get(site.ligand)
    if (entry) {
      entry.sites += 1
      entry.residues += site.residues
    } else {
      totals.set(site.ligand, {
        name: site.ligand,
        chebi: site.chebi,
        sites: 1,
        residues: site.residues,
      })
    }
  }
  return [...totals.values()].sort(
    (a, b) => b.residues - a.residues || a.name.localeCompare(b.name),
  )
}
