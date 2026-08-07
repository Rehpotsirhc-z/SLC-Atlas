// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from "react"
import type { RefObject } from "react"
import type { ClusterNode } from "@/types/clustering"
import type { GeneRow } from "./useGeneRows"

interface RowFocusOptions {
  containerRef: RefObject<HTMLDivElement | null>
  clusterNodes: ClusterNode[]
  geneRows: GeneRow[]
  rowByGene: Map<string, number>
  cellH: number
  topH: number
  selectedGeneId: string | null
  containerW: number
}

export function useRowFocus({
  containerRef,
  clusterNodes,
  geneRows,
  rowByGene,
  cellH,
  topH,
  selectedGeneId,
  containerW,
}: RowFocusOptions) {
  const scrollToRow = useCallback(
    (row: number) => {
      const c = containerRef.current
      if (!c) return
      c.scrollTo({ top: topH + row * cellH - c.clientHeight / 2, behavior: "smooth" })
    },
    [containerRef, cellH, topH],
  )

  const lastFocus = useRef<{ nodes: ClusterNode[]; gene: string } | null>(null)
  useEffect(() => {
    if (!selectedGeneId || containerW === 0) return
    const row = rowByGene.get(selectedGeneId)
    if (row === undefined) return
    if (lastFocus.current?.nodes === clusterNodes && lastFocus.current?.gene === selectedGeneId)
      return
    lastFocus.current = { nodes: clusterNodes, gene: selectedGeneId }
    scrollToRow(row)
  }, [clusterNodes, selectedGeneId, rowByGene, scrollToRow, containerW])

  const resetView = useCallback(
    () => containerRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" }),
    [containerRef],
  )

  const focusGene = useCallback(
    (geneId: string) => {
      const r = rowByGene.get(geneId)
      if (r !== undefined) scrollToRow(r)
    },
    [rowByGene, scrollToRow],
  )

  const focusFamily = useCallback(
    (family: string) => {
      const rows = geneRows.flatMap((g, i) => (g.family === family ? [i] : []))
      if (rows.length) scrollToRow(rows[Math.floor(rows.length / 2)])
    },
    [geneRows, scrollToRow],
  )

  return { resetView, focusGene, focusFamily }
}
