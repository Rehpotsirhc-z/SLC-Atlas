// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { Gene } from "@/types/gene"
import type { FeatureSpan, GeneTopology, MembraneSegment, StructureRecord } from "@/types/structure"
import type { ThemeMode } from "@/theme"
import { getFamilyColor } from "@/utils/familyColor"

export interface WallGene {
  geneId: string
  symbol: string
  family: string
  category: string | null
  length: number
  segments: MembraneSegment[]
  features: FeatureSpan[]
  nTransmembrane: number
  nExperimental: number
  bestPdbId: string | null
  color: string
}

export interface WallGroup {
  key: string
  nTransmembrane: number | null
  family: string | null
  familyDetail: string | null
  genes: WallGene[]
}

export interface Wall {
  membrane: boolean
  groups: WallGroup[]
}

export const EMPTY_WALL: Wall = { membrane: true, groups: [] }

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

const bySymbol = (a: WallGene, b: WallGene) =>
  a.symbol.localeCompare(b.symbol, undefined, { numeric: true })

function byHelixCount(genes: WallGene[]): WallGroup[] {
  const counts = new Map<number, WallGene[]>()
  for (const gene of genes) {
    const members = counts.get(gene.nTransmembrane) ?? []
    members.push(gene)
    counts.set(gene.nTransmembrane, members)
  }

  return [...counts.entries()]
    .map(([nTransmembrane, members]) => ({
      key: `tm-${nTransmembrane}`,
      nTransmembrane,
      family: null,
      familyDetail: null,
      genes: members.sort(bySymbol),
    }))
    .sort((a, b) => a.nTransmembrane - b.nTransmembrane)
}

function byFamily(genes: WallGene[]): WallGroup[] {
  const families = new Map<string, WallGene[]>()
  for (const gene of genes) {
    const members = families.get(gene.family) ?? []
    members.push(gene)
    families.set(gene.family, members)
  }

  return [...families.entries()]
    .map(([family, members]) => ({
      key: `family-${family}`,
      nTransmembrane: null,
      family,
      familyDetail: members[0].category,
      genes: members.sort(bySymbol),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { numeric: true }))
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
      category: gene.category,
      length: entry.uniprot_length ?? record.uniprot_length ?? 0,
      segments: entry.segments,
      features: entry.features,
      nTransmembrane: record.n_transmembrane,
      nExperimental: record.n_experimental,
      bestPdbId: record.best_pdb_id,
      color: getFamilyColor(gene.family, mode),
    })
  }

  const membrane = genes.some((gene) => gene.segments.length > 0)
  return { membrane, groups: membrane ? byHelixCount(genes) : byFamily(genes) }
}
