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
import { useConservation, useSpeciesTree } from "@/api/hooks/useConservation"
import { useGeneById } from "@/api/hooks/useGenes"
import { useUIStore } from "@/store/uiStore"
import { usePublishPopup } from "@/store/usePublishPopup"
import { uniqueFamilies, uniqueGeneOptions } from "@/utils/geneOptions"
import type { CellMetricKey } from "./ConservationHeatmap"

export function useConservationState(cellMetric: CellMetricKey) {
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)
  const metric = useUIStore((s) => s.treeMetric)
  const setMetric = useUIStore((s) => s.setTreeMetric)
  const tissue = useUIStore((s) => s.treeTissue)
  const setTissue = useUIStore((s) => s.setTreeTissue)

  const method = resolveClusterMethod(metric, tissue)
  const { data: cells, isLoading: cl, error: ce } = useConservation()
  const { data: speciesNodes, isLoading: sl, error: se } = useSpeciesTree()
  const { data: clusterNodes, isLoading: tl, error: te } = useClustering(method)
  const geneById = useGeneById()

  const selectedInfo = useMemo(() => {
    if (!cells || !selectedGeneId) return null
    const first = cells.find((c) => c.gene_id === selectedGeneId)
    if (!first) return null
    const geneCells = cells.filter(
      (c) => c.gene_id === selectedGeneId && c.orthology_type !== "self",
    )
    return {
      geneId: selectedGeneId,
      symbol: first.symbol ?? selectedGeneId,
      family: first.family,
      gene: geneById.get(selectedGeneId) ?? null,
      cells: geneCells,
    }
  }, [cells, selectedGeneId, geneById])

  const popupContent = useMemo(
    () =>
      selectedInfo
        ? ({ kind: "conservation", info: selectedInfo, metric: cellMetric } as const)
        : null,
    [selectedInfo, cellMetric],
  )
  usePublishPopup(popupContent, !!cells)

  const families = useMemo(() => uniqueFamilies(cells ?? []), [cells])
  const genes = useMemo(() => uniqueGeneOptions(cells ?? []), [cells])
  const nSpecies = useMemo(
    () => (speciesNodes ? speciesNodes.filter((n) => n.species).length : 0),
    [speciesNodes],
  )

  return {
    cells,
    speciesNodes,
    clusterNodes,
    geneById,
    isLoading: cl || sl || tl,
    error: ce || se || te,
    ready: !!(cells && speciesNodes && clusterNodes),
    families,
    genes,
    counterText: `${genes.length} genes · ${nSpecies} species`,
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
