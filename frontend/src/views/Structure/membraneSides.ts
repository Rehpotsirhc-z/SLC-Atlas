// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ProteinFeature } from "@/types/structure"
import { TRACK } from "./constants"

// Which face of the bilayer a stretch of chain sits on. "inside" is the cytoplasm-equivalent
// face, which is the matrix for the inner mitochondrial membrane and the cytosol everywhere
// else; "outside" is the non-cytoplasmic face
export type Side = "outside" | "inside"

export const opposite = (side: Side): Side => (side === "inside" ? "outside" : "inside")

type Compartment = "cytosol" | "matrix" | "intermembrane" | "extracellular" | "lumen"

// UniProt's topological-domain vocabulary. An unlisted description resolves to no
// compartment, which leaves the stretch unanchored rather than guessing a face for it
const COMPARTMENTS: [string, Compartment][] = [
  ["mitochondrial matrix", "matrix"],
  ["mitochondrial intermembrane", "intermembrane"],
  ["cytoplasmic", "cytosol"],
  ["extracellular", "extracellular"],
  ["lumenal", "lumen"],
  ["vesicular", "lumen"],
]

const MEMBRANE_NAMES: [Compartment, Compartment, string][] = [
  ["matrix", "intermembrane", "Inner mitochondrial membrane"],
  ["matrix", "cytosol", "Inner mitochondrial membrane"],
  ["cytosol", "intermembrane", "Outer mitochondrial membrane"],
  ["cytosol", "extracellular", "Plasma membrane"],
  ["cytosol", "lumen", "Intracellular membrane"],
]

// True of either face under the standard convention, whichever organelle the protein sits in
const FALLBACK_LABELS: Record<Side, string> = {
  inside: "Cytoplasmic side",
  outside: "Non-cytoplasmic side",
}

/** Trim a compartment name to what the figure's left gutter can hold. */
export function laneLabel(label: string): string {
  const short = label
    .replace(/^Mitochondrial /, "")
    .replace(/,.*$/, "")
    .replace(/ side$/, "")
  const cased = short.charAt(0).toUpperCase() + short.slice(1)
  return cased.length > TRACK.maxLaneLabel ? `${cased.slice(0, TRACK.maxLaneLabel - 1)}…` : cased
}

function compartmentOf(description: string | null): Compartment | null {
  const text = description?.toLowerCase() ?? ""
  return COMPARTMENTS.find(([name]) => text.includes(name))?.[1] ?? null
}

export interface MembraneFaces {
  sideOf: (description: string | null) => Side | null
  labels: Record<Side, string>
  membrane: string
}

/** Resolve the two faces from the compartments this protein's own annotation names. */
export function membraneFaces(domains: ProteinFeature[]): MembraneFaces {
  const present = new Set<Compartment>()
  for (const domain of domains) {
    const compartment = compartmentOf(domain.description)
    if (compartment) present.add(compartment)
  }

  // The matrix is the inner membrane's cytoplasm-equivalent face, so it outranks the loose
  // "Cytoplasmic" some carriers use for the intermembrane side
  const inside: Compartment = present.has("matrix") ? "matrix" : "cytosol"
  const sideOf = (description: string | null): Side | null => {
    const compartment = compartmentOf(description)
    if (!compartment) return null
    return compartment === inside ? "inside" : "outside"
  }

  const counts: Record<Side, Map<string, number>> = { inside: new Map(), outside: new Map() }
  for (const domain of domains) {
    const side = sideOf(domain.description)
    if (!side || !domain.description) continue
    counts[side].set(domain.description, (counts[side].get(domain.description) ?? 0) + 1)
  }
  const commonest = (side: Side) =>
    [...counts[side]].sort((a, b) => b[1] - a[1])[0]?.[0] ?? FALLBACK_LABELS[side]

  const membrane =
    MEMBRANE_NAMES.find(([a, b]) => present.has(a) && present.has(b))?.[2] ??
    (present.has("matrix") ? "Inner mitochondrial membrane" : "Membrane")

  return {
    sideOf,
    labels: { inside: commonest("inside"), outside: commonest("outside") },
    membrane,
  }
}
