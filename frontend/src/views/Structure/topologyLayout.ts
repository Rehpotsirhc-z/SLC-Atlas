// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { TRACK } from "./constants"
import type { ProteinFeature } from "@/types/structure"

// Which side of the membrane a topological domain sits on. Compartments other
// than the cytoplasm (extracellular, lumenal, vesicular) all read as "outside" here.
export type Side = "inside" | "outside"

export interface HelixSegment {
  index: number
  start: number
  end: number
  x: number
  width: number
  description: string | null
}

export interface LoopSegment {
  start: number
  end: number
  x: number
  width: number
  side: Side
  description: string | null
}

export interface LigandSite {
  residue: number
  x: number
  ligand: string
  chebi: string | null
}

export interface AxisTick {
  residue: number
  x: number
}

export interface TopologyLayout {
  length: number
  helices: HelixSegment[]
  loops: LoopSegment[]
  sites: LigandSite[]
  ticks: AxisTick[]
  ligands: { name: string; count: number; chebi: string | null }[]
}

function sideOf(description: string | null): Side {
  return description?.toLowerCase().startsWith("cytoplasmic") ? "inside" : "outside"
}

function axisTicks(length: number, toX: (residue: number) => number): AxisTick[] {
  const ticks: AxisTick[] = [{ residue: 1, x: toX(1) }]
  for (let r = TRACK.tickSpacing; r < length; r += TRACK.tickSpacing) {
    ticks.push({ residue: r, x: toX(r) })
  }
  ticks.push({ residue: length, x: toX(length) })
  return ticks
}

function ligandTotals(sites: LigandSite[]) {
  const totals = new Map<string, { name: string; count: number; chebi: string | null }>()
  for (const site of sites) {
    const entry = totals.get(site.ligand)
    if (entry) entry.count += 1
    else totals.set(site.ligand, { name: site.ligand, count: 1, chebi: site.chebi })
  }
  return [...totals.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function layoutTopology(
  features: ProteinFeature[],
  length: number,
  width: number,
): TopologyLayout {
  const inner = Math.max(width - TRACK.padX * 2, 1)
  const span = Math.max(length - 1, 1)
  const toX = (residue: number) => TRACK.padX + ((residue - 1) / span) * inner

  const helices: HelixSegment[] = features
    .filter((f) => f.feature_type === "transmembrane")
    .sort((a, b) => a.start - b.start)
    .map((f, i) => ({
      index: i + 1,
      start: f.start,
      end: f.end,
      x: toX(f.start),
      width: Math.max(toX(f.end) - toX(f.start), 2),
      description: f.description,
    }))

  const loops: LoopSegment[] = features
    .filter((f) => f.feature_type === "topological_domain")
    .map((f) => ({
      start: f.start,
      end: f.end,
      x: toX(f.start),
      width: Math.max(toX(f.end) - toX(f.start), 1),
      side: sideOf(f.description),
      description: f.description,
    }))

  const sites: LigandSite[] = features
    .filter((f) => f.feature_type === "binding_site" || f.feature_type === "active_site")
    .map((f) => ({
      residue: f.start,
      x: toX(f.start),
      ligand: f.ligand_name ?? (f.feature_type === "active_site" ? "Active site" : "Ligand"),
      chebi: f.ligand_chebi,
    }))

  return {
    length,
    helices,
    loops,
    sites,
    ticks: axisTicks(length, toX),
    ligands: ligandTotals(sites),
  }
}
