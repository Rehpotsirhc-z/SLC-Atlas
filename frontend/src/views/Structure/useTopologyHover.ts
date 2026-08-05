// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from "react"
import { mergeSpans } from "./bindingSites"
import {
  highlightFor,
  relatedTo,
  spansOf,
  targetAtResidue,
  targetKey,
  type TopologyTarget,
} from "./topologyTargets"
import type { ChainModel } from "./chainModel"
import type { ResidueSpan } from "./molstar/types"

const replaceWhenDifferent = (next: TopologyTarget | null) => (current: TopologyTarget | null) =>
  targetKey(current) === targetKey(next) ? current : next

export function useTopologyHover(model: ChainModel, protein: string | null) {
  const [hover, setHover] = useState<TopologyTarget | null>(null)
  const [viewerHover, setViewerHover] = useState<TopologyTarget | null>(null)
  const [cameraSpans, setCameraSpans] = useState<ResidueSpan[] | null>(null)

  useEffect(() => {
    setHover(null)
    setViewerHover(null)
    setCameraSpans(null)
  }, [protein])

  const track = useCallback((target: TopologyTarget) => setHover(replaceWhenDifferent(target)), [])
  const clear = useCallback(() => setHover(null), [])

  const select = useCallback(
    (target: TopologyTarget) => setCameraSpans(mergeSpans(spansOf(target))),
    [],
  )

  const hoverResidue = useCallback(
    (residue: number | null) =>
      setViewerHover(
        replaceWhenDifferent(residue === null ? null : targetAtResidue(model, residue)),
      ),
    [model],
  )

  const pointed = hover ?? viewerHover
  const highlight = useMemo(() => relatedTo(model, pointed), [model, pointed])

  const highlightSpans = useMemo(() => highlightFor(model, hover), [model, hover])

  return { hover, track, clear, highlight, select, hoverResidue, highlightSpans, cameraSpans }
}
