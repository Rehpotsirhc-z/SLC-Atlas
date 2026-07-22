// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { Gene, Transcript } from "@/types/gene"

export const useGenes = () =>
  useQuery({
    queryKey: ["genes"],
    queryFn: () => api.get<Gene[]>("/genes"),
  })

export function useGeneById(): Map<string, Gene> {
  const { data } = useGenes()
  return useMemo(() => {
    const m = new Map<string, Gene>()
    for (const g of data ?? []) m.set(g.id, g)
    return m
  }, [data])
}

export const useTranscripts = (geneId: string | null) =>
  useQuery({
    queryKey: ["transcripts", geneId],
    queryFn: () => api.get<Transcript[]>(`/genes/${geneId}/transcripts`),
    enabled: geneId != null,
  })
