// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from "react"
import { useTheme } from "@mui/material"
import { useGeneById, useGenes } from "@/api/hooks/useGenes"
import {
  useExperimentalStructures,
  useProteinFeatures,
  useStructureDetail,
  useStructures,
  useTopology,
} from "@/api/hooks/useStructure"
import { useUIStore } from "@/store/uiStore"
import { buildModelOptions, PREDICTED_ID } from "./modelOptions"
import { buildWall } from "./topologyWall"
import type { ModelSource } from "./molstar/types"

export function useStructureState() {
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  // Keyed by gene so picking an entry for one gene cannot leak into the next
  const [pdbChoice, setPdbChoice] = useState<{ geneId: string; pdbId: string } | null>(null)

  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)

  const { palette } = useTheme()
  const { data: structures, isLoading, error } = useStructures()
  const { data: allGenes } = useGenes()
  const { data: topology } = useTopology()
  const geneById = useGeneById()
  const { data: detail } = useStructureDetail(selectedGeneId)
  const { data: features } = useProteinFeatures(selectedGeneId)
  const { data: experimental } = useExperimentalStructures(selectedGeneId)

  // The rail and search bar only offer genes the structure tables actually cover
  const genes = useMemo(() => {
    if (!structures || !allGenes) return []
    const covered = new Set(structures.map((s) => s.gene_id))
    return allGenes.filter((g) => covered.has(g.id))
  }, [structures, allGenes])

  // The list record renders at once, the detail swaps in when its confidence array lands
  const selected = useMemo(
    () =>
      detail?.gene_id === selectedGeneId
        ? detail
        : (structures?.find((s) => s.gene_id === selectedGeneId) ?? null),
    [detail, structures, selectedGeneId],
  )

  const withExperimental = useMemo(
    () => (structures ?? []).filter((s) => s.n_experimental > 0).length,
    [structures],
  )

  const wall = useMemo(
    () => buildWall(topology, structures, geneById, familyFilter, palette.mode),
    [topology, structures, geneById, familyFilter, palette.mode],
  )

  const selectGene = useCallback(
    (geneId: string) => {
      setSelectedGeneId(geneId)
      const family = geneById.get(geneId)?.family
      if (family) setFamilyFilter(family)
    },
    [geneById, setSelectedGeneId],
  )

  const selectedPdbId = pdbChoice?.geneId === selectedGeneId ? pdbChoice.pdbId : null
  const selectPdbId = useCallback(
    (pdbId: string | null) =>
      setPdbChoice(pdbId && selectedGeneId ? { geneId: selectedGeneId, pdbId } : null),
    [selectedGeneId],
  )

  const modelOptions = useMemo(
    () => buildModelOptions(selected, experimental),
    [selected, experimental],
  )

  // The predicted model opens by default: it is the only one every gene has, and the only
  // one numbered in the same residues as the topology figure
  const modelSource = useMemo<ModelSource | null>(() => {
    const chosen = modelOptions.find((option) => option.id === (selectedPdbId ?? PREDICTED_ID))
    return chosen?.source ?? null
  }, [modelOptions, selectedPdbId])

  return {
    structures,
    wall,
    genes,
    selected,
    plddt: detail?.gene_id === selectedGeneId ? (detail?.plddt ?? null) : null,
    sequence: detail?.gene_id === selectedGeneId ? (detail?.sequence ?? null) : null,
    selectedGene: selectedGeneId ? (geneById.get(selectedGeneId) ?? null) : null,
    features,
    experimental,
    isLoading,
    error,
    familyFilter,
    setFamilyFilter,
    selectedGeneId,
    setSelectedGeneId,
    selectGene,
    selectedPdbId,
    selectPdbId,
    modelOptions,
    modelSource,
    withExperimental,
    counterText: `${structures?.length ?? 0} genes · ${withExperimental} solved`,
  }
}
