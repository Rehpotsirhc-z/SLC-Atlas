// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Translate between track and Ensembl chromosome names */

import type { Chrom } from "@/types/browser"

/** Fold the spellings of one chromosome onto a single key. */
export function normaliseChrom(name: string): string {
  const bare = name.trim().toLowerCase().replace(/^chr/, "")
  if (bare === "mt" || bare === "mito" || bare === "mtdna") return "m"
  return bare
}

export interface ChromNames {
  /** Whatever this dataset's tracks call it, or null when it has no such chromosome */
  track: (name: string) => string | null
  /** What the gene table calls it */
  ensembl: (name: string) => string | null
}

export function chromNames(chroms: Chrom[]): ChromNames {
  const byKey = new Map<string, Chrom>()
  for (const chrom of chroms) {
    byKey.set(normaliseChrom(chrom.chrom), chrom)
    byKey.set(normaliseChrom(chrom.ensembl), chrom)
  }
  return {
    track: (name) => byKey.get(normaliseChrom(name))?.chrom ?? null,
    ensembl: (name) => byKey.get(normaliseChrom(name))?.ensembl ?? null,
  }
}
