// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Sampling the pLDDT array down to this many gradient stops keeps the markup small
const CONFIDENCE_STOPS = 220

// One gradient stop; only colour carries the score, the lane height is constant
export interface ConfidenceStop {
  // 0-1 along the residue axis
  offset: number
  score: number
}

/**
 * AlphaFold indexes pLDDT by its model's own sequence, so an array that is not exactly as
 * long as the residue axis cannot be aligned to it and is dropped rather than stretched.
 */
export function confidenceStops(plddt: number[] | null, length: number): ConfidenceStop[] {
  if (!plddt?.length || plddt.length !== length) return []

  const span = Math.max(plddt.length - 1, 1)
  const bucket = Math.max(1, Math.ceil(plddt.length / CONFIDENCE_STOPS))
  const stops: ConfidenceStop[] = []
  for (let i = 0; i < plddt.length; i += bucket) {
    const slice = plddt.slice(i, i + bucket)
    const mean = slice.reduce((sum, score) => sum + score, 0) / slice.length
    // The mean belongs at the middle of the residues it averages, not at the first of them
    stops.push({ offset: (i + (slice.length - 1) / 2) / span, score: mean })
  }
  stops[0].offset = 0
  stops[stops.length - 1].offset = 1
  return stops
}
