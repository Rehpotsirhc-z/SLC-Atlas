// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useDeferredValue, useMemo, useState } from "react"
import { useGenes } from "@/api/hooks/useGenes"
import { useUIStore } from "@/store/uiStore"
import type { Gene } from "@/types/gene"
import { FAMILY_PARAM } from "@/utils/shareParams"
import { useShareParam } from "@/utils/useShareParam"
import { DIR_PARAM, ROWS_PARAM, SEARCH_MIRROR_MS, SEARCH_PARAM, SORT_PARAM } from "./shareParams"

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
  const [searchText, setSearchText] = useShareParam(SEARCH_PARAM, {
    mirrorDebounceMs: SEARCH_MIRROR_MS,
  })
  const [familyFilter, setFamilyFilter] = useShareParam(FAMILY_PARAM)
  const [sortKey, setSortKey] = useShareParam(SORT_PARAM)
  const [sortDirection, setSortDirection] = useShareParam(DIR_PARAM)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useShareParam(ROWS_PARAM)
  const [expandedGeneIds, setExpandedGeneIds] = useState<ReadonlySet<string>>(() => new Set())
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)

  const search = useCallback((text: string) => {
    setSearchText(text)
    if (text.trim()) setFamilyFilter(null)
  }, [])

  const selectFamily = useCallback((family: string | null) => {
    setFamilyFilter(family)
    if (family) setSearchText("")
  }, [])

  const deferredSearchText = useDeferredValue(searchText)
  const deferredFamilyFilter = useDeferredValue(familyFilter)
  const visibleGenes = useMemo(
    () =>
      sortGenes(
        filterGenes(genes, deferredSearchText, deferredFamilyFilter),
        sortKey,
        sortDirection,
      ),
    [genes, deferredSearchText, deferredFamilyFilter, sortKey, sortDirection],
  )

  useEffect(() => {
    setPage(0)
  }, [deferredSearchText, deferredFamilyFilter])

  useEffect(() => {
    if (!selectedGeneId) return
    setExpandedGeneIds((prev) =>
      prev.has(selectedGeneId) ? prev : new Set(prev).add(selectedGeneId),
    )
  }, [selectedGeneId])

  const toggleExpanded = useCallback((geneId: string) => {
    setExpandedGeneIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(geneId)) next.add(geneId)
      return next
    })
  }, [])

  const resetView = useCallback(() => {
    setExpandedGeneIds(new Set())
    setPage(0)
  }, [])

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
    setFamilyFilter: selectFamily,
    sortKey,
    sortDirection,
    toggleSort,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    expandedGeneIds,
    toggleExpanded,
    resetView,
  }
}
