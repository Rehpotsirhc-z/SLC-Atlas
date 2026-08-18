// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Averaging the pLDDT array down to this many bars keeps the markup small
const CONFIDENCE_BARS = 220

// One flat bar of the strip, spanning 0-1 of the residue axis
export interface ConfidenceBar {
  from: number
  to: number
  score: number
}

// AlphaFold indexes pLDDT by its model's own sequence, so an array that is not exactly as
// long as the residue axis cannot be aligned to it and is dropped rather than stretched.
export function confidenceBars(plddt: number[] | null, length: number): ConfidenceBar[] {
  if (!plddt?.length || plddt.length !== length) return []

  // Residue centres sit at 0 and 1, so a bar reaches half a residue past the ones it averages
  const span = Math.max(plddt.length - 1, 1)
  const bucket = Math.max(1, Math.ceil(plddt.length / CONFIDENCE_BARS))
  const bars: ConfidenceBar[] = []
  for (let i = 0; i < plddt.length; i += bucket) {
    const slice = plddt.slice(i, i + bucket)
    const mean = slice.reduce((sum, score) => sum + score, 0) / slice.length
    bars.push({
      from: Math.max((i - 0.5) / span, 0),
      to: Math.min((i + slice.length - 0.5) / span, 1),
      score: mean,
    })
  }
  return bars
}
