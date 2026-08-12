// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Load gene models and GWAS variants for the current genomic block. */

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { gwasUrl, modelsUrl, readFeatures } from "@/api/bbi"
import { parseTranscript, parseVariant } from "@/api/features"
import type { GwasPoint, TranscriptModel } from "@/types/browser"
import { GWAS_FULL_MAX_SPAN, GWAS_OVERVIEW_SUFFIX } from "./constants"
import type { Viewport } from "./scale"
import type { CoverageBlock } from "./useCoverageData"

const NO_TRANSCRIPTS: TranscriptModel[] = []
const NO_POINTS: GwasPoint[] = []

export interface GeneModels {
  transcripts: TranscriptModel[]
  gap: number
  loading: boolean
  /** No models are available in the loaded block */
  empty: boolean
}

export function useGeneModels(chrom: string | undefined, block: CoverageBlock | null): GeneModels {
  const query = useQuery({
    queryKey: ["browser", "models", chrom, block?.start, block?.end],
    queryFn: ({ signal }) =>
      readFeatures(modelsUrl(), chrom as string, block!.start, block!.end, signal).then((rows) =>
        rows.map((row) => parseTranscript(chrom as string, row)),
      ),
    enabled: chrom != null && block != null,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  })

  return useMemo(() => {
    const transcripts = query.data ?? NO_TRANSCRIPTS
    let low = Infinity
    let high = -Infinity
    for (const model of transcripts) {
      if (model.start < low) low = model.start
      if (model.end > high) high = model.end
    }
    // Taken from what was loaded rather than from the view, so rows do not repack on zoom
    const gap = transcripts.length ? Math.round((high - low) * 0.01) : 0
    return {
      transcripts,
      gap,
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
) {
  const thinned = view.end - view.start > GWAS_FULL_MAX_SPAN
  const file = studyId == null ? null : thinned ? `${studyId}${GWAS_OVERVIEW_SUFFIX}` : studyId

  const query = useQuery({
    queryKey: ["browser", "gwas", file, chrom, block?.start, block?.end],
    queryFn: ({ signal }) =>
      readFeatures(gwasUrl(file as string), chrom as string, block!.start, block!.end, signal).then(
        (rows) => rows.map(parseVariant),
      ),
    enabled: chrom != null && block != null && file != null,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  })

  return useMemo(
    () => ({ points: query.data ?? NO_POINTS, loading: query.isPending, thinned }),
    [query.data, query.isPending, thinned],
  )
}
