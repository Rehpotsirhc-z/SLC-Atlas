// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Load gene models and GWAS variants for the current genomic block. */

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { READ_OFFSCREEN, READ_VISIBLE, gwasUrl, modelsUrl, readFeatures } from "@/api/bbi"
import { parseTranscript, parseVariant } from "@/api/features"
import type { GwasPoint, TranscriptModel } from "@/types/browser"
import { GWAS_FULL_MAX_SPAN, GWAS_LANE_KEY, GWAS_OVERVIEW_SUFFIX } from "./constants"
import type { Viewport } from "./scale"
import type { CoverageBlock } from "./useCoverageData"

const NO_TRANSCRIPTS: TranscriptModel[] = []
const NO_POINTS: GwasPoint[] = []

export interface GeneModels {
  transcripts: TranscriptModel[]
  loading: boolean
  /** No models are available in the loaded block */
  empty: boolean
}

export function useGeneModels(chrom: string | undefined, block: CoverageBlock | null): GeneModels {
  const query = useQuery({
    queryKey: ["browser", "models", chrom, block?.start, block?.end],
    // The gene track is pinned to the bottom of the frame, so it is never the read that can wait
    queryFn: ({ signal }) =>
      readFeatures({
        url: modelsUrl(),
        chrom: chrom as string,
        start: block!.start,
        end: block!.end,
        signal,
        priority: () => READ_VISIBLE,
      }).then((rows) => rows.map((row) => parseTranscript(chrom as string, row))),
    enabled: chrom != null && block != null,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  })

  return useMemo(() => {
    const transcripts = query.data ?? NO_TRANSCRIPTS
    return {
      transcripts,
      loading: query.isPending,
      empty: !query.isPending && transcripts.length === 0,
    }
  }, [query.data, query.isPending])
}

/** Load full or summarized GWAS variants depending on the visible span. */
export function useVisibleGwas(
  chrom: string | undefined,
  block: CoverageBlock | null,
  view: Viewport,
  studyId: string | null,
  isVisible: (key: string) => boolean,
) {
  const thinned = view.end - view.start > GWAS_FULL_MAX_SPAN
  const file = studyId == null ? null : thinned ? `${studyId}${GWAS_OVERVIEW_SUFFIX}` : studyId

  const query = useQuery({
    queryKey: ["browser", "gwas", file, chrom, block?.start, block?.end],
    queryFn: ({ signal }) =>
      readFeatures({
        url: gwasUrl(file as string),
        chrom: chrom as string,
        start: block!.start,
        end: block!.end,
        signal,
        priority: () => (isVisible(GWAS_LANE_KEY) ? READ_VISIBLE : READ_OFFSCREEN),
      }).then((rows) => rows.map(parseVariant)),
    enabled: chrom != null && block != null && file != null,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  })

  return useMemo(
    () => ({ points: query.data ?? NO_POINTS, loading: query.isPending, thinned }),
    [query.data, query.isPending, thinned],
  )
}
