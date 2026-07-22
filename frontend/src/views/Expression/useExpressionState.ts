// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import {
  resolveClusterMethod,
  useClustering,
  type TreeMetric,
  type TreeTissue,
} from "@/api/hooks/useClustering"
import { useExpressionMatrix } from "@/api/hooks/useExpression"
import { useGeneById } from "@/api/hooks/useGenes"
import { useUIStore } from "@/store/uiStore"
import { usePublishPopup } from "@/store/usePublishPopup"
import { uniqueFamilies, uniqueGeneOptions } from "@/utils/geneOptions"

export function useExpressionState() {
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const metric = useUIStore((s) => s.expressionMetric)
  const setMetric = useUIStore((s) => s.setExpressionMetric)
  const tissue = useUIStore((s) => s.expressionTissue)
  const setTissue = useUIStore((s) => s.setExpressionTissue)

  const method = resolveClusterMethod(metric, tissue)
  const { data: rows, isLoading: el, error: ee } = useExpressionMatrix(tissue)
  const { data: clusterNodes, isLoading: tl, error: te } = useClustering(method)
  const geneById = useGeneById()

  const selectedInfo = useMemo(() => {
    if (!rows || !selectedGeneId) return null
    const geneRows = rows.filter((r) => r.gene_id === selectedGeneId)
    if (!geneRows.length) return null
    const first = geneRows[0]
    return {
      geneId: selectedGeneId,
      symbol: first.symbol ?? selectedGeneId,
      family: first.family,
      gene: geneById.get(selectedGeneId) ?? null,
      rows: geneRows,
    }
  }, [rows, selectedGeneId, geneById])

  const popupContent = useMemo(
    () => (selectedInfo ? ({ kind: "expression", info: selectedInfo } as const) : null),
    [selectedInfo],
  )
  usePublishPopup(popupContent, !!rows)

  const families = useMemo(() => uniqueFamilies(rows ?? []), [rows])
  const genes = useMemo(() => uniqueGeneOptions(rows ?? []), [rows])
  const presentTissues = useMemo(() => new Set((rows ?? []).map((r) => r.tissue)), [rows])

  return {
    rows,
    clusterNodes,
    geneById,
    selectedInfo,
    isLoading: el || tl,
    error: ee || te,
    ready: !!(rows && clusterNodes),
    families,
    genes,
    presentTissues,
    counterText: `${genes.length} genes · ${presentTissues.size} tissues`,
    familyFilter,
    setFamilyFilter,
    selectedGeneId,
    setSelectedGeneId,
    metric,
    setMetric: setMetric as (m: TreeMetric) => void,
    tissue,
    setTissue: setTissue as (t: TreeTissue) => void,
    method,
  }
}
