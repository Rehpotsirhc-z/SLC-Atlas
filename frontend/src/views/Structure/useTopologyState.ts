// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { buildChainModel, EMPTY_MODEL } from "./chainModel"
import { EMPTY_SNAKE, layoutSnake } from "./snakeLayout"
import { EMPTY_LAYOUT, layoutTopology } from "./topologyLayout"
import { useTopologyHover } from "./useTopologyHover"
import type { ProteinFeature } from "@/types/structure"

export type TopologyMode = "linear" | "snake"

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

  const layout = useMemo(
    () => (mode === "linear" && model.length ? layoutTopology(model, width, plddt) : EMPTY_LAYOUT),
    [mode, model, width, plddt],
  )

  const snake = useMemo(
    () => (mode === "snake" && model.length ? layoutSnake(model, plddt, sequence) : EMPTY_SNAKE),
    [mode, model, plddt, sequence],
  )

  // Only the snake plot has a mark small enough for a viewer pick to land on one residue
  return { model, layout, snake, ...useTopologyHover(model, protein, mode === "snake") }
}
