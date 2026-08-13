// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Read visible coverage from bigWigs in reusable blocks.
 *
 * Blocks keep nearby pans in memory, while resolution remains part of each query key. Visible
 * lanes are prioritized, and previous results remain on screen until replacements arrive. At
 * wide views, tracks use only summary resolutions verified by the build pipeline.
 */

import { useMemo, useRef } from "react"
import { useQueries } from "@tanstack/react-query"
import {
  EMPTY_COVERAGE,
  READ_OFFSCREEN,
  READ_VISIBLE,
  readCoverage,
  trackUrl,
  type CoverageArrays,
} from "@/api/bbi"
import type { CoverageTrack } from "@/types/browser"
import { COVERAGE_BLOCK_MARGIN_MAX, COVERAGE_BLOCK_MIN, SUMMARY_MAX_COLUMNS } from "./constants"
import type { Viewport } from "./scale"

export interface LaneData {
  plus: CoverageArrays
  minus: CoverageArrays | null
  loading: boolean
  failed: boolean
  /** The track has no data on this chromosome at all, which is not the same as a flat lane */
  absent: boolean
}

const EMPTY_LANE: LaneData = {
  plus: EMPTY_COVERAGE,
  minus: null,
  loading: false,
  failed: false,
  absent: true,
}

const sameLane = (a: LaneData, b: LaneData) =>
  a.plus === b.plus &&
  a.minus === b.minus &&
  a.loading === b.loading &&
  a.failed === b.failed &&
  a.absent === b.absent

export interface CoverageBlock {
  start: number
  end: number
}

/** Return a stable read block containing the view and a bounded pan margin. */
export function coverageBlock(view: Viewport, chromSize: number): CoverageBlock {
  const span = Math.max(view.end - view.start, 1)
  const margin = Math.min(span * 1.5, COVERAGE_BLOCK_MARGIN_MAX)
  const size = Math.min(
    chromSize,
    Math.max(COVERAGE_BLOCK_MIN, 2 ** Math.ceil(Math.log2(span + margin * 2))),
  )
  const step = size / 4
  const aligned = Math.floor(view.start / step) * step - step
  // Slid off the grid where the grid would leave part of the view outside the block: a stretch
  // on screen that was never read draws as a lane carrying no signal
  const first = Math.max(0, view.end - size)
  const last = Math.min(view.start, chromSize - size)
  const start = Math.round(Math.min(Math.max(aligned, first), last))
  return { start, end: Math.round(start + size) }
}

/** Keep the current block until the view moves outside it. */
export function useCoverageBlock(
  view: Viewport,
  chrom: string | undefined,
  chromSize: number,
): CoverageBlock | null {
  const held = useRef<{ chrom: string; block: CoverageBlock } | null>(null)
  if (!chrom || chromSize <= 0) return null
  const kept = held.current
  if (
    kept &&
    kept.chrom === chrom &&
    view.start >= kept.block.start &&
    view.end <= kept.block.end
  ) {
    return kept.block
  }
  const block = coverageBlock(view, chromSize)
  held.current = { chrom, block }
  return block
}

interface Request {
  trackId: string
  strand: "plus" | "minus" | null
  url: string
  /** Bases a summary record should stand for, or 0 to read every stored record */
  step: number
}

/** Return a stable power-of-two summary resolution no coarser than one screen column. */
export function summaryStep(view: Viewport, width: number): number {
  const perColumn = (view.end - view.start) / Math.max(width, 1)
  return 2 ** Math.floor(Math.log2(Math.max(perColumn, 1)))
}

export function useCoverageData(
  tracks: CoverageTrack[],
  chrom: string | undefined,
  block: CoverageBlock | null,
  isVisible: (trackId: string) => boolean,
  step: number,
) {
  const requests = useMemo<Request[]>(() => {
    if (!chrom) return []
    const out: Request[] = []
    for (const track of tracks) {
      if (track.chroms.length > 0 && !track.chroms.includes(chrom)) continue
      // Never finer than the width the build vouched for, so the reader cannot answer from a level
      // it was not checked at, and never so much coarser that the lane turns into steps
      const floor = track.reduction
      const summary = floor > 0 && floor <= step * SUMMARY_MAX_COLUMNS ? Math.max(step, floor) : 0
      for (const strand of track.stranded ? (["plus", "minus"] as const) : [null]) {
        const url = trackUrl(track, strand)
        if (url) out.push({ trackId: track.track_id, strand, url, step: summary })
      }
    }
    return out
  }, [tracks, chrom, step])

  const results = useQueries({
    queries: requests.map((request) => ({
      queryKey: [
        "browser",
        "coverage",
        request.url,
        chrom,
        block?.start ?? 0,
        block?.end ?? 0,
        request.step,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readCoverage({
          url: request.url,
          chrom: chrom as string,
          start: block!.start,
          end: block!.end,
          signal,
          priority: () => (isVisible(request.trackId) ? READ_VISIBLE : READ_OFFSCREEN),
          basesPerSpan: request.step || undefined,
        }),
      enabled: chrom != null && block != null && block.end > block.start,
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      placeholderData: (previous: CoverageArrays | undefined) => previous,
    })),
  })

  const stamp = results.map((r) => `${r.status}${r.dataUpdatedAt}`).join("|")

  // What each read last answered with. A read that has answered at all replaces what it held,
  // empty or not, since a stretch a track genuinely does not cover must draw as uncovered
  const shown = useRef(new Map<string, CoverageArrays>())
  const readChrom = useRef(chrom)
  if (readChrom.current !== chrom) {
    shown.current.clear()
    readChrom.current = chrom
  }

  // What each lane was last given, so a lane whose own reads have not moved is handed the object
  // it already had and its canvas is left alone while another track's read lands
  const lanes = useRef(new Map<string, LaneData>())

  return useMemo(() => {
    const built = new Map<string, LaneData>()
    requests.forEach((request, index) => {
      const result = results[index]
      const held = built.get(request.trackId) ?? {
        plus: EMPTY_COVERAGE,
        minus: null,
        loading: false,
        failed: false,
        absent: false,
      }
      if (result?.data) shown.current.set(request.url, result.data)
      const data = result?.data ?? shown.current.get(request.url) ?? EMPTY_COVERAGE
      if (request.strand === "minus") held.minus = data
      else held.plus = data
      held.loading ||= result?.isPending ?? false
      held.failed ||= result?.isError ?? false
      built.set(request.trackId, held)
    })
    for (const track of tracks) {
      if (!built.has(track.track_id)) built.set(track.track_id, EMPTY_LANE)
    }

    const kept = lanes.current
    const stable = new Map<string, LaneData>()
    let unchanged = built.size === kept.size
    for (const [trackId, lane] of built) {
      const last = kept.get(trackId)
      const use = last && sameLane(last, lane) ? last : lane
      if (use !== last) unchanged = false
      stable.set(trackId, use)
    }
    if (unchanged) return kept
    lanes.current = stable
    return stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, tracks, stamp])
}
