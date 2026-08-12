// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Load annotation and association data for visible windows */

import { useMemo, useRef } from "react"
import { useQueries } from "@tanstack/react-query"
import { api } from "@/api/client"
import type { GwasPoint, Region, TranscriptModel } from "@/types/browser"
import type { Gene } from "@/types/gene"
import type { Viewport } from "./scale"

// The widest a window's flank can reach, so a gene whose models could touch the view is asked
// for even though its own span does not overlap it
const WINDOW_REACH = 600_000

// A burst of windows helps nobody; past this the view is too wide for models to be legible
const MAX_WINDOWS = 12

const NO_TRANSCRIPTS: TranscriptModel[] = []

export interface GeneModels {
  transcripts: TranscriptModel[]
  gap: number
  loading: boolean
  /** The view has travelled past everything this dataset carries models for */
  empty: boolean
}

const NO_GENES: string[] = []

/**
 * The genes whose windows could carry anything the view is looking at. A move that reaches the
 * same windows keeps the list it had, since everything downstream of this is keyed on it and
 * most moves reach nowhere new.
 */
export function useNearbyGenes(
  genes: Gene[],
  chromEnsembl: string | undefined,
  view: Viewport,
): string[] {
  const held = useRef(NO_GENES)
  return useMemo(() => {
    const found = !chromEnsembl
      ? NO_GENES
      : genes
          .filter(
            (gene) =>
              gene.chromosome === chromEnsembl &&
              gene.end + WINDOW_REACH > view.start &&
              gene.start - WINDOW_REACH < view.end,
          )
          .slice(0, MAX_WINDOWS)
          .map((gene) => gene.id)
    const settled = held.current
    if (found.length === settled.length && found.every((id, at) => id === settled[at])) {
      return settled
    }
    held.current = found
    return found
  }, [genes, chromEnsembl, view])
}

export function useGeneModels(nearby: string[]): GeneModels {
  const results = useQueries({
    queries: nearby.map((geneId) => ({
      // The same key useRegion uses, so the selected gene's window is never fetched twice
      queryKey: ["browser", geneId, "region"],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<Region>(`/browser/${geneId}/region.json`, signal),
      staleTime: Infinity,
    })),
  })

  const stamp = results.map((r) => `${r.status}${r.dataUpdatedAt}`).join("|")

  return useMemo(() => {
    const byId = new Map<string, TranscriptModel>()
    let loading = false
    for (const result of results) {
      if (result.isPending) loading = true
      for (const model of result.data?.transcripts ?? NO_TRANSCRIPTS) {
        // Windows overlap where genes cluster, so the same transcript arrives more than once
        if (!byId.has(model.transcript_id)) byId.set(model.transcript_id, model)
      }
    }
    const transcripts = [...byId.values()]
    let low = Infinity
    let high = -Infinity
    for (const model of transcripts) {
      if (model.start < low) low = model.start
      if (model.end > high) high = model.end
    }
    // Taken from what was loaded rather than from the view, so rows do not repack on zoom
    const gap = transcripts.length ? Math.round((high - low) * 0.01) : 0
    return { transcripts, gap, loading, empty: !loading && transcripts.length === 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, nearby])
}

const NO_POINTS: GwasPoint[] = []

/** The study's variants across every window the view overlaps, in position order. */
export function useVisibleGwas(nearby: string[], studyId: string | null) {
  const results = useQueries({
    queries: nearby.map((geneId) => ({
      queryKey: ["browser", geneId, "gwas", studyId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.get<GwasPoint[]>(`/browser/${geneId}/gwas/${studyId}.json`, signal),
      enabled: studyId != null,
      staleTime: Infinity,
    })),
  })

  const stamp = results.map((r) => `${r.status}${r.dataUpdatedAt}`).join("|")

  return useMemo(() => {
    const seen = new Set<number>()
    const points: GwasPoint[] = []
    for (const result of results) {
      for (const point of result.data ?? NO_POINTS) {
        // Neighbouring windows overlap, and a variant in both would be drawn twice
        if (seen.has(point.position)) continue
        seen.add(point.position)
        points.push(point)
      }
    }
    points.sort((a, b) => a.position - b.position)
    return { points, loading: results.some((r) => r.isPending) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, nearby])
}
