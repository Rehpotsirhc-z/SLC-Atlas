// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Resolve plot clicks to gene and coverage readouts

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react"
import {
  binRangeAt,
  binReadout,
  genePickFrom,
  type CoverageAssay,
  type GenePick,
  type TrackGroup,
} from "./browserPick"
import type { GeneTrackHandle } from "./GeneTrack"
import type { Bin } from "./drawCoverage"
import type { Viewport } from "./scale"
import type { LaneData } from "./useCoverageData"

export type Picked =
  | { kind: "bin"; base: number; trackId: string | null }
  | { kind: "gene"; gene: GenePick }

interface Options {
  geneTrackRef: RefObject<GeneTrackHandle | null>
  groups: TrackGroup[]
  coverage: Map<string, LaneData>
  colors: Map<string, string>
  fallbackColor: string
  committedView: Viewport
}

export function useBrowserPick({
  geneTrackRef,
  groups,
  coverage,
  colors,
  fallbackColor,
  committedView,
}: Options) {
  const [picked, setPicked] = useState<Picked | null>(null)

  const onPick = useCallback(
    (base: number, clientX: number, clientY: number) => {
      // The hover tooltip ignores pointer events, leaving the clicked track underneath
      const hit = document.elementFromPoint(clientX, clientY)
      if (!hit) return
      if (hit.closest("[data-gene-track]")) {
        const item = geneTrackRef.current?.pickAt(clientX, clientY)
        setPicked(item ? { kind: "gene", gene: genePickFrom(item) } : null)
        return
      }
      const lane = hit.closest("[data-coverage-lane]")
      if (lane) {
        setPicked({
          kind: "bin",
          base: Math.floor(base),
          trackId: lane.getAttribute("data-coverage-lane"),
        })
      }
    },
    [geneTrackRef],
  )

  const dismiss = useCallback(() => setPicked(null), [])

  // Close readouts after panning or zooming
  useEffect(() => {
    setPicked(null)
  }, [committedView])

  const binAssays = useMemo<CoverageAssay[] | null>(
    () =>
      picked?.kind === "bin"
        ? binReadout(picked.base, groups, coverage, colors, fallbackColor)
        : null,
    [picked, groups, coverage, colors, fallbackColor],
  )

  const binRange = useMemo<Bin | null>(
    () => (picked?.kind === "bin" ? binRangeAt(picked.base, picked.trackId, coverage) : null),
    [picked, coverage],
  )

  return { picked, onPick, dismiss, binAssays, binRange }
}
