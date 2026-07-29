// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react"
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

export type Hover = TopologyTarget & { x: number; y: number }

const DIM = 0.3

export function useTopologyHover(layout: TopologyLayout, protein: string | null) {
  const [hover, setHover] = useState<Hover | null>(null)
  const [viewerHover, setViewerHover] = useState<TopologyTarget | null>(null)
  const [cameraSpans, setCameraSpans] = useState<ResidueSpan[] | null>(null)

  // Residue numbers mean something else in the next protein, so nothing carries over
  useEffect(() => {
    setHover(null)
    setViewerHover(null)
    setCameraSpans(null)
  }, [protein])

  const track = (event: MouseEvent, target: TopologyTarget) =>
    setHover({ ...target, x: event.clientX, y: event.clientY })
  const clear = () => setHover(null)

  // A click on the figure only brings its residues into view; nothing about it persists
  const select = useCallback(
    (target: TopologyTarget) => setCameraSpans(mergeSpans(spansOf(target))),
    [],
  )

  // The viewer reports every mouse move, so a pointer travelling along one helix must not
  // re-push the same highlight into it
  const hoverResidue = useCallback(
    (residue: number | null) => {
      const next = residue === null ? null : targetAtResidue(layout, residue)
      setViewerHover((current) => (targetKey(current) === targetKey(next) ? current : next))
    },
    [layout],
  )

  const pointed = hover ?? viewerHover
  const highlight = useMemo(() => relatedTo(layout, pointed), [layout, pointed])

  const dimmed = (lit: boolean) => (highlight.size > 0 && !lit ? DIM : 1)

  // Only the figure's own pointer reaches into the viewer: while the cursor is on the canvas
  // Mol* is marking what it picked, and this keeps its identity so nothing overwrites that
  const highlightSpans = useMemo(
    () => spansForSets(layout, relatedTo(layout, hover)),
    [layout, hover],
  )

  return {
    hover,
    track,
    clear,
    highlight,
    dimmed,
    select,
    hoverResidue,
    highlightSpans,
    cameraSpans,
  }
}
