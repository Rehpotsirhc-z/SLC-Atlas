// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Translate between track and Ensembl chromosome names

import type { Chrom } from "@/types/browser"

// Fold the spellings of one chromosome onto a single key.
export function normalizeChrom(name: string): string {
  const bare = name.trim().toLowerCase().replace(/^chr/, "")
  if (bare === "mt" || bare === "mito" || bare === "mtdna") return "m"
  return bare
}

export interface ChromNames {
  // Name used by track files, or null if the chromosome is unavailable
  track: (name: string) => string | null
  // Name used by gene data
  ensembl: (name: string) => string | null
}

export function chromNames(chroms: Chrom[]): ChromNames {
  const byKey = new Map<string, Chrom>()
  for (const chrom of chroms) {
    byKey.set(normalizeChrom(chrom.chrom), chrom)
    byKey.set(normalizeChrom(chrom.ensembl), chrom)
  }
  return {
    track: (name) => byKey.get(normalizeChrom(name))?.chrom ?? null,
    ensembl: (name) => byKey.get(normalizeChrom(name))?.ensembl ?? null,
  }
}
