// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Warm visible track indexes at the lowest read priority.

import { useEffect } from "react"
import { gwasUrl, modelsUrl, trackUrl, warmCoverage, warmFeatures } from "@/api/bbi"
import type { Chrom, CoverageTrack } from "@/types/browser"

export function useWarmReaders(
  tracks: CoverageTrack[],
  chroms: Chrom[],
  studyId: string | null,
): void {
  useEffect(() => {
    // Any chromosome in the file warms its shared index
    const fallback = chroms[0]?.chrom
    if (!fallback) return
    for (const track of tracks) {
      const chrom = track.chroms[0] ?? fallback
      for (const strand of track.stranded ? (["plus", "minus"] as const) : [null]) {
        const url = trackUrl(track, strand)
        if (url) warmCoverage(url, chrom)
      }
    }
    warmFeatures(modelsUrl(), fallback)
    if (studyId) warmFeatures(gwasUrl(studyId), fallback)
  }, [tracks, chroms, studyId])
}
