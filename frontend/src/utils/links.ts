// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { Gene } from "@/types/gene"

export function ensemblUrl(geneId: string, species = "homo_sapiens"): string {
  const path = species
    .split("_")
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join("_")
  return `https://www.ensembl.org/${path}/Gene/Summary?db=core;g=${geneId}`
}

export function ucscUrl(gene: Pick<Gene, "chromosome" | "start" | "end">): string {
  return `https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr${gene.chromosome}:${gene.start}-${gene.end}`
}
