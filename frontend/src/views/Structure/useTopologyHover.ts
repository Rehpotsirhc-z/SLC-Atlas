// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from "react"
import { mergeSpans } from "./bindingSites"
import {
  relatedTo,
  spansForSets,
  spansOf,
  targetAtResidue,
  targetKey,
  type TopologyTarget,
} from "./topologyTargets"
import type { TopologyLayout } from "./topologyLayout"
import type { ResidueSpan } from "./molstar/types"

const replaceWhenDifferent = (next: TopologyTarget | null) => (current: TopologyTarget | null) =>
  targetKey(current) === targetKey(next) ? current : next

export function useTopologyHover(layout: TopologyLayout, protein: string | null) {
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
        replaceWhenDifferent(residue === null ? null : targetAtResidue(layout, residue)),
      ),
    [layout],
  )

  const pointed = hover ?? viewerHover
  const highlight = useMemo(() => relatedTo(layout, pointed), [layout, pointed])

  const highlightSpans = useMemo(
    () => spansForSets(layout, relatedTo(layout, hover)),
    [layout, hover],
  )

  return { hover, track, clear, highlight, select, hoverResidue, highlightSpans, cameraSpans }
}
