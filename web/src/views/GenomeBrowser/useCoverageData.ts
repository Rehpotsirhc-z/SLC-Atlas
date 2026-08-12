// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Coverage for whatever is on screen, read straight out of the bigWigs by byte range.
 *
 * A slice holds every window the family has on that chromosome, not just the gene that was
 * searched for, so the view is free to travel the whole chromosome and will find the other
 * loci when it passes over them. Reads are taken a block at a time rather than a screen at a
 * time, and a block is held for as long as the view sits inside it: records come back at their
 * stored resolution whatever the block spans, so bytes already held answer a zoom or a pan
 * exactly as a fresh read would, and re-keying every lane would throw its data away to learn
 * nothing. Only a view that leaves the block asks for another.
 *
 * What a lane last read is kept for as long as it is on screen, and drawn until its successor
 * arrives. Bytes that have been asked for are not a reason to show nothing: the coordinates
 * are absolute, so held records land where they belong under a moved view, and the lane
 * sharpens when the read lands instead of blinking out and back.
 *
 * Records are always read at their stored resolution, never through the file's reduced views.
 * Those views were measured to report signal across stretches that hold none: reading
 * chr9:49-84 Mb of a sliced track returns nothing at all at full resolution and 13,673
 * summary records at a reduced one, every one carrying the same value with its minimum equal
 * to its maximum. Whatever produces them, drawing them invents coverage where a track has
 * none, which is the one mistake this view must not make. Full resolution is affordable here
 * precisely because a slice is sparse: a whole chromosome of one is a few tens of thousands
 * of records, since the pipeline kept only the windows around the family's genes.
 */

import { useMemo, useRef } from "react"
import { useQueries } from "@tanstack/react-query"
import { EMPTY_COVERAGE, readCoverage, trackUrl, type CoverageArrays } from "@/api/bbi"
import type { CoverageTrack } from "@/types/browser"
import { COVERAGE_BLOCK_MARGIN_MAX, COVERAGE_BLOCK_MIN } from "./constants"
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

/**
 * The stretch a lane is read in: the view, plus a screen and a half either side while that is
 * affordable and a fixed margin past the point where it is not, rounded up to a power of two no
 * smaller than the floor and snapped to a quarter of itself so the same locus asks for the same
 * bytes twice.
 */
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

/**
 * The block every lane is read in, kept for as long as the view sits inside its bytes. The block
 * decides how much is held, never at what resolution, so a view the held bytes already cover has
 * nothing to gain from a block of its own.
 */
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
}

export function useCoverageData(
  tracks: CoverageTrack[],
  chrom: string | undefined,
  block: CoverageBlock | null,
) {
  const requests = useMemo<Request[]>(() => {
    if (!chrom) return []
    const out: Request[] = []
    for (const track of tracks) {
      if (track.chroms.length > 0 && !track.chroms.includes(chrom)) continue
      for (const strand of track.stranded ? (["plus", "minus"] as const) : [null]) {
        const url = trackUrl(track, strand)
        if (url) out.push({ trackId: track.track_id, strand, url })
      }
    }
    return out
  }, [tracks, chrom])

  const results = useQueries({
    queries: requests.map((request) => ({
      queryKey: ["browser", "coverage", request.url, chrom, block?.start ?? 0, block?.end ?? 0],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        readCoverage(request.url, chrom as string, block!.start, block!.end, signal),
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
