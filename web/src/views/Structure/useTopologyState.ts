// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { buildChainModel, EMPTY_MODEL } from "./chainModel"
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
}

export function useTopologyState({
  features,
  length,
  width,
  plddt,
  sequence,
  protein,
  mode,
}: Options) {
  const model = useMemo(
    () => (features.length && length ? buildChainModel(features, length) : EMPTY_MODEL),
    [features, length],
  )

  const regions = useMemo(
    () => (mode === "regions" && model.length ? layoutRegions(model, width, plddt) : EMPTY_REGIONS),
    [mode, model, width, plddt],
  )

  const residues = useMemo(
    () =>
      mode === "residues" && model.length ? layoutResidues(model, plddt, sequence) : EMPTY_RESIDUES,
    [mode, model, plddt, sequence],
  )

  // Only the residues plot has a mark small enough for a viewer pick to land on one residue
  return { model, regions, residues, ...useTopologyHover(model, protein, mode === "residues") }
}
