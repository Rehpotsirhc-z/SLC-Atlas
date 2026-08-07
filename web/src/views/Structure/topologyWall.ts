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
  category: string | null
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

export const EMPTY_WALL: Wall = { groups: [] }

export interface WallSummary {
  count: number
  category: string | null
}

export function summariseWall(wall: Wall, family: string | null): WallSummary {
  let count = 0
  let category: string | null = null
  for (const group of wall.groups) {
    for (const gene of group.genes) {
      if (family && gene.family !== family) continue
      count += 1
      if (family) category = gene.category
    }
  }
  return { count, category }
}

export function buildWall(
  topology: GeneTopology[] | undefined,
  structures: StructureRecord[] | undefined,
  geneById: Map<string, Gene>,
  mode: ThemeMode,
): Wall {
  if (!topology || !structures) return EMPTY_WALL

  const recordById = new Map(structures.map((s) => [s.gene_id, s]))
  const genes: WallGene[] = []
  for (const entry of topology) {
    const record = recordById.get(entry.gene_id)
    const gene = geneById.get(entry.gene_id)
    if (!record || !gene) continue
    genes.push({
      geneId: entry.gene_id,
      symbol: gene.symbol,
      family: gene.family,
      familyName: gene.family_name,
      category: gene.category,
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
