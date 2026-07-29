// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { EMPTY_LAYOUT, layoutTopology } from "./topologyLayout"
import { useTopologyHover } from "./useTopologyHover"
import type { ProteinFeature } from "@/types/structure"

export function useTopologyState(
  features: ProteinFeature[],
  length: number,
  width: number,
  plddt: number[] | null,
  protein: string | null,
) {
  const layout = useMemo(
    () =>
      features.length && length ? layoutTopology(features, length, width, plddt) : EMPTY_LAYOUT,
    [features, length, width, plddt],
  )
  return { layout, ...useTopologyHover(layout, protein) }
}
