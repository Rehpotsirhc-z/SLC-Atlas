// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { Gene } from "@/types/gene"
import type { GeneTopology, MembraneSegment, StructureRecord } from "@/types/structure"
import type { ThemeMode } from "@/theme"
import { getFamilyColor } from "@/utils/familyColor"

export interface WallGene {
  geneId: string
  symbol: string
  family: string
  familyName: string
  length: number
  segments: MembraneSegment[]
  nTransmembrane: number
  nExperimental: number
  bestPdbId: string | null
  color: string
}

export interface WallGroup {
  nTransmembrane: number
  genes: WallGene[]
}

export interface Wall {
  groups: WallGroup[]
}

const EMPTY: Wall = { groups: [] }

export function buildWall(
  topology: GeneTopology[] | undefined,
  structures: StructureRecord[] | undefined,
  geneById: Map<string, Gene>,
  familyFilter: string | null,
  mode: ThemeMode,
): Wall {
  if (!topology || !structures) return EMPTY

  const recordById = new Map(structures.map((s) => [s.gene_id, s]))
  const genes: WallGene[] = []
  for (const entry of topology) {
    const record = recordById.get(entry.gene_id)
    const gene = geneById.get(entry.gene_id)
    if (!record || !gene) continue
    if (familyFilter && gene.family !== familyFilter) continue
    genes.push({
      geneId: entry.gene_id,
      symbol: gene.symbol,
      family: gene.family,
      familyName: gene.family_name,
      length: entry.uniprot_length ?? record.uniprot_length ?? 0,
      segments: entry.segments,
      nTransmembrane: record.n_transmembrane,
      nExperimental: record.n_experimental,
      bestPdbId: record.best_pdb_id,
      color: getFamilyColor(gene.family, mode),
    })
  }

  const byCount = new Map<number, WallGene[]>()
  for (const gene of genes) {
    const members = byCount.get(gene.nTransmembrane) ?? []
    members.push(gene)
    byCount.set(gene.nTransmembrane, members)
  }

  const groups = [...byCount.entries()]
    .map(([nTransmembrane, members]) => ({
      nTransmembrane,
      genes: members.sort((a, b) => a.symbol.localeCompare(b.symbol, undefined, { numeric: true })),
    }))
    .sort((a, b) => a.nTransmembrane - b.nTransmembrane)

  return { groups }
}
