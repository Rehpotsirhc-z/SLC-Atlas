// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Coverage for whatever is on screen, read straight out of the bigWigs by byte range.
 *
 * A slice holds every window the family has on that chromosome, not just the gene that was
 * searched for, so the view is free to travel the whole chromosome and will find the other
 * loci when it passes over them. Reads are taken a block at a time rather than a screen at a
 * time: the block is a power of two wide and aligned to a quarter of itself, so an ordinary
 * zoom or pan around a gene keeps asking for the block it was already given, and only
 * travelling out of one costs a read.
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
import { EMPTY_COVERAGE, readCoverage, trackUrl, type CoverageArrays } from "@/api/bigwig"
import type { CoverageTrack } from "@/types/browser"
import { COVERAGE_BLOCK_MIN } from "./constants"
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

export interface CoverageBlock {
  start: number
  end: number
}

/**
 * The stretch a lane is read in: four times what the view can see, so the view always sits in
 * the middle half of it with a screen's worth of margin on either side, and rounded up to a
 * power of two no smaller than the floor. Zooming in asks for a subset of what is already
 * held, so it is answered by the same block rather than by a read of its own.
 */
export function coverageBlock(view: Viewport, chromSize: number): CoverageBlock {
  const span = Math.max(view.end - view.start, 1)
  const size = Math.max(COVERAGE_BLOCK_MIN, 2 ** Math.ceil(Math.log2(span * 4)))
  const step = size / 4
  const start = Math.max(0, Math.floor(view.start / step) * step - step)
  return { start, end: Math.min(chromSize, start + size) }
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
        readCoverage(request.url, chrom as string, block!.start, block!.end, undefined, signal),
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

  return useMemo(() => {
    const lanes = new Map<string, LaneData>()
    requests.forEach((request, index) => {
      const result = results[index]
      const held = lanes.get(request.trackId) ?? {
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
      lanes.set(request.trackId, held)
    })
    for (const track of tracks) {
      if (!lanes.has(track.track_id)) lanes.set(track.track_id, EMPTY_LANE)
    }
    return lanes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, tracks, stamp])
}
