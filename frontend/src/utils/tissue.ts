// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// All brain-scope tissue names share a "Brain - " prefix, which is redundant once
// the view is already scoped to brain subregions — drop it for display.
export function displayTissue(tissue: string): string {
  return tissue.startsWith("Brain - ") ? tissue.slice(8) : tissue
}

export function sortedTissues(rows: { tissue: string }[]): string[] {
  return [...new Set(rows.map((r) => r.tissue))].sort()
}
