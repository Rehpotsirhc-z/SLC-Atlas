// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useDeferredValue, useMemo, useState } from "react"
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

function chrRank(chr: string): number {
  const n = parseInt(chr, 10)
  if (!isNaN(n)) return n
  if (chr === "X") return 23
  if (chr === "Y") return 24
  if (chr === "MT") return 25
  return 99
}

function sortGenes(genes: Gene[], sortKey: SortKey, direction: SortDirection): Gene[] {
  const sign = direction === "asc" ? 1 : -1
  return [...genes].sort((a, b) => {
    if (sortKey === "position") {
      return sign * (chrRank(a.chromosome) - chrRank(b.chromosome) || a.start - b.start)
    }
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === "number" && typeof bv === "number") return sign * (av - bv)
    return sign * String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true })
  })
}

export function useGeneAnnotationState() {
  const { data: genes = [], isLoading, error } = useGenes()
  const [searchText, setSearchText] = useState("")
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("symbol")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const search = useCallback((text: string) => {
    setSearchText(text)
    if (text.trim()) setFamilyFilter(null)
  }, [])

  const deferredSearchText = useDeferredValue(searchText)
  const visibleGenes = useMemo(
    () => sortGenes(filterGenes(genes, deferredSearchText, familyFilter), sortKey, sortDirection),
    [genes, deferredSearchText, familyFilter, sortKey, sortDirection],
  )

  useEffect(() => {
    setPage(0)
  }, [deferredSearchText, familyFilter])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  return {
    genes,
    isLoading,
    error,
    visibleGenes,
    searchText,
    setSearchText: search,
    familyFilter,
    setFamilyFilter,
    sortKey,
    sortDirection,
    toggleSort,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
  }
}
