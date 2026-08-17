// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Load gene models and GWAS variants for the current genomic block. */

import { useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  EMPTY_VARIANTS,
  READ_OFFSCREEN,
  READ_VISIBLE,
  gwasUrl,
  modelsUrl,
  readFeatures,
  readVariants,
  type VariantBlock,
} from "@/api/bbi"
import { parseTranscript } from "@/api/features"
import type { GwasStudy, TranscriptModel } from "@/types/browser"
import { GWAS_LANE_KEY } from "./constants"
import { levelChrom, pickLevel } from "./gwasLevels"
import type { CoverageBlock } from "./useCoverageData"

const NO_TRANSCRIPTS: TranscriptModel[] = []
const NO_VARIANTS = EMPTY_VARIANTS

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

// Load GWAS variants at the finest useful resolution
export function useVisibleGwas(
  chrom: string | undefined,
  block: CoverageBlock | null,
  step: number,
  study: GwasStudy | undefined,
  isVisible: (key: string) => boolean,
) {
  const studyId = study?.study_id ?? null
  const bin = pickLevel(step, study?.levels ?? [])
  const source = chrom == null ? null : levelChrom(chrom, bin)

  const query = useQuery({
    queryKey: ["browser", "gwas", studyId, source, block?.start, block?.end],
    queryFn: ({ signal }) =>
      readVariants({
        url: gwasUrl(studyId as string),
        chrom: source as string,
        start: block!.start,
        end: block!.end,
        signal,
        priority: () => (isVisible(GWAS_LANE_KEY) ? READ_VISIBLE : READ_OFFSCREEN),
      }),
    enabled: source != null && block != null && studyId != null,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  })

  // Keep the previous level visible while the next loads, but never across chromosomes
  const held = useRef<{ chrom: string; block: VariantBlock } | null>(null)
  if (query.data && chrom != null) held.current = { chrom, block: query.data }
  const kept = held.current
  const carried = kept && kept.chrom === chrom ? kept.block : NO_VARIANTS

  return useMemo(
    () => ({ block: query.data ?? carried, loading: query.isPending, bin }),
    [query.data, carried, query.isPending, bin],
  )
}
