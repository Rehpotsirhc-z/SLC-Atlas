// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import { useGeneById, useGenes } from "@/api/hooks/useGenes"
import {
  useExperimentalStructures,
  useProteinFeatures,
  useStructures,
} from "@/api/hooks/useStructure"
import { useUIStore } from "@/store/uiStore"

export function useStructureState() {
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)

  const { data: structures, isLoading, error } = useStructures()
  const { data: allGenes } = useGenes()
  const geneById = useGeneById()
  const { data: features } = useProteinFeatures(selectedGeneId)
  const { data: experimental } = useExperimentalStructures(selectedGeneId)

  // the rail and search bar only offer genes the structure tables actually cover
  const genes = useMemo(() => {
    if (!structures || !allGenes) return []
    const covered = new Set(structures.map((s) => s.gene_id))
    return allGenes.filter((g) => covered.has(g.id))
  }, [structures, allGenes])

  const selected = useMemo(
    () => structures?.find((s) => s.gene_id === selectedGeneId) ?? null,
    [structures, selectedGeneId],
  )

  const withExperimental = useMemo(
    () => (structures ?? []).filter((s) => s.n_experimental > 0).length,
    [structures],
  )

  return {
    structures,
    genes,
    selected,
    selectedGene: selectedGeneId ? (geneById.get(selectedGeneId) ?? null) : null,
    features,
    experimental,
    isLoading,
    error,
    familyFilter,
    setFamilyFilter,
    selectedGeneId,
    setSelectedGeneId,
    withExperimental,
    counterText: `${structures?.length ?? 0} genes · ${withExperimental} solved`,
  }
}
