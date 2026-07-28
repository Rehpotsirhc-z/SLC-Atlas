// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// AlphaFold's pLDDT bands, most to least confident, in its own wording and its own colours,
// which are what Mol* paints the 3D model with
export const PLDDT_BANDS = [
  { min: 90, color: "#0053d6", short: "very high", range: ">90", label: "very high confidence" },
  { min: 70, color: "#65cbf3", short: "confident", range: "70-90", label: "confident" },
  { min: 50, color: "#ffdb13", short: "low", range: "50-70", label: "low confidence" },
  {
    min: 0,
    color: "#ff7d45",
    short: "very low",
    range: "<50",
    label: "very low, treat as unreliable",
  },
] as const

function bandFor(score: number) {
  return PLDDT_BANDS.find((band) => score >= band.min) ?? PLDDT_BANDS[3]
}

export function plddtBand(score: number): string {
  return bandFor(score).label
}

export function confidenceColor(score: number): string {
  return bandFor(score).color
}
