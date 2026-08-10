// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { buildChainModel, EMPTY_MODEL } from "./chainModel"
import { EMPTY_FEATURES, layoutFeatures } from "./featuresLayout"
import { EMPTY_REGIONS, layoutRegions } from "./regionsLayout"
import { EMPTY_RESIDUES, layoutResidues } from "./residuesLayout"
import { useTopologyHover } from "./useTopologyHover"
import type { ProteinFeature } from "@/types/structure"

export type TopologyMode = "regions" | "residues"

interface Options {
  features: ProteinFeature[]
  length: number
  width: number
  plddt: number[] | null
  sequence: string | null
  protein: string | null
  mode: TopologyMode
  membrane: boolean
}

export function useTopologyState({
  features,
  length,
  width,
  plddt,
  sequence,
  protein,
  mode,
  membrane,
}: Options) {
  const model = useMemo(
    () => (length ? buildChainModel(features, length) : EMPTY_MODEL),
    [features, length],
  )

  const regions = useMemo(
    () =>
      membrane && mode === "regions" && model.length
        ? layoutRegions(model, width, plddt)
        : EMPTY_REGIONS,
    [membrane, mode, model, width, plddt],
  )

  const residues = useMemo(
    () =>
      membrane && mode === "residues" && model.length
        ? layoutResidues(model, plddt, sequence)
        : EMPTY_RESIDUES,
    [membrane, mode, model, plddt, sequence],
  )

  const featureMap = useMemo(
    () => (!membrane && length ? layoutFeatures(model, width, plddt) : EMPTY_FEATURES),
    [membrane, model, width, plddt, length],
  )

  // Rail and bead figures map viewer picks to individual residues
  const perResidue = !membrane || mode === "residues"

  return {
    model,
    membrane,
    regions,
    residues,
    featureMap,
    ...useTopologyHover(model, protein, perResidue),
  }
}
