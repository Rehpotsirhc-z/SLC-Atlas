// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import {
  METHOD_LABEL,
  resolveClusterMethod,
  useClustering,
  type TreeMetric,
  type TreeTissue,
} from "@/api/hooks/useClustering"
import { useGeneById, useGenes } from "@/api/hooks/useGenes"
import { tissueParam } from "@/store/shareArrival"
import { useUIStore } from "@/store/uiStore"
import { usePublishPopup } from "@/store/usePublishPopup"
import { uniqueFamilies, uniqueGeneOptions } from "@/utils/geneOptions"
import { FAMILY_PARAM } from "@/utils/shareParams"
import { useShareMirror, useShareParam } from "@/utils/useShareParam"
import { CLUSTERING_METRIC } from "./shareParams"

export function useClusteringState() {
  const [familyFilter, setFamilyFilter] = useShareParam(FAMILY_PARAM)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const metric = useUIStore((s) => s.clusteringMetric)
  const setMetric = useUIStore((s) => s.setClusteringMetric)
  const tissue = useUIStore((s) => s.clusteringTissue)
  const setTissue = useUIStore((s) => s.setClusteringTissue)

  useShareMirror(CLUSTERING_METRIC, metric)
  const tissueDescriptor = useMemo(() => tissueParam("tissue", metric), [metric])
  useShareMirror(tissueDescriptor, tissue)

  const method = resolveClusterMethod(metric, tissue)
  const { data, isLoading, error } = useClustering(method)
  const { data: allGenes } = useGenes()
  const geneById = useGeneById()

  const selectedInfo = useMemo(() => {
    if (!data || !selectedGeneId) return null
    const node = data.find((n) => n.gene_id === selectedGeneId)
    if (!node) return null
    let closestSymbol: string | null = null
    if (node.parent_id !== null) {
      const sibling = data.find((n) => n.parent_id === node.parent_id && n.node_id !== node.node_id)
      if (sibling?.gene_id) closestSymbol = sibling.symbol
    }
    const gene = allGenes?.find((g) => g.id === selectedGeneId) ?? null
    return { node, methodLabel: METHOD_LABEL[method], closestSymbol, gene }
  }, [data, selectedGeneId, method, allGenes])

  const popupContent = useMemo(
    () => (selectedInfo ? ({ kind: "clustering", info: selectedInfo } as const) : null),
    [selectedInfo],
  )
  usePublishPopup(popupContent, !!data)

  const families = useMemo(() => uniqueFamilies(data ?? []), [data])
  const genes = useMemo(() => uniqueGeneOptions(data ?? []), [data])

  return {
    data,
    isLoading,
    error,
    geneById,
    families,
    genes,
    leafCount: genes.length,
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
