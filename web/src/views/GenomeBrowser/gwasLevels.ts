// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Select the GWAS pyramid level for the current scale

// Return the coarsest level no wider than one screen column
export function pickLevel(step: number, levels: readonly number[]): number {
  let picked = 0
  for (const bin of levels) {
    if (bin <= step) picked = Math.max(picked, bin)
  }
  return picked
}

// Return the chromosome name for a pyramid level
export function levelChrom(chrom: string, bin: number): string {
  return bin > 0 ? `${chrom}.z${bin}` : chrom
}
