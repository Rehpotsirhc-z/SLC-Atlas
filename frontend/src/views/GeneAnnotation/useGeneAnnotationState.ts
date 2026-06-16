// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import { useGenes } from "@/api/hooks/useGenes"
import type { Gene } from "@/types/gene"

export type SortKey = "id" | "symbol" | "name" | "position" | "length" | "category" | "family"
export type SortDirection = "asc" | "desc"

function filterGenes(genes: Gene[], searchText: string, familyFilter: string | null): Gene[] {
  let result = genes
  if (familyFilter) {
    result = result.filter((g) => g.family === familyFilter)
  }
  const needle = searchText.trim().toLowerCase()
  if (!needle) return result
  return result.filter((g) =>
    [g.id, g.symbol, g.name, g.alias, g.category].some((field) =>
      field?.toLowerCase().includes(needle),
    ),
  )
}

function sortGenes(genes: Gene[], sortKey: SortKey, direction: SortDirection): Gene[] {
  const sign = direction === "asc" ? 1 : -1
  return [...genes].sort((a, b) => {
    if (sortKey === "position") {
      return sign * (a.start - b.start || a.chromosome.localeCompare(b.chromosome))
    }
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === "number" && typeof bv === "number") return sign * (av - bv)
    return sign * String(av ?? "").localeCompare(String(bv ?? ""))
  })
}

export function useGeneAnnotationState() {
  const { data: genes = [], isLoading, error } = useGenes()
  const [searchText, setSearchText] = useState("")
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("symbol")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [expandedGeneIds, setExpandedGeneIds] = useState<Set<string>>(new Set())

  const visibleGenes = useMemo(
    () => sortGenes(filterGenes(genes, searchText, familyFilter), sortKey, sortDirection),
    [genes, searchText, familyFilter, sortKey, sortDirection],
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  function toggleExpanded(geneId: string) {
    setExpandedGeneIds((prev) => {
      const next = new Set(prev)
      if (next.has(geneId)) {
        next.delete(geneId)
      } else {
        next.add(geneId)
      }
      return next
    })
  }

  return {
    genes,
    isLoading,
    error,
    visibleGenes,
    searchText,
    setSearchText,
    familyFilter,
    setFamilyFilter,
    sortKey,
    sortDirection,
    toggleSort,
    expandedGeneIds,
    toggleExpanded,
  }
}
