import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { Gene, Transcript } from "../../types/gene"

export const useGenes = (search?: string) =>
  useQuery({
    queryKey: ["genes", search],
    queryFn: () =>
      api.get<Gene[]>(`/genes${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  })

export const useTranscripts = (geneId: string | null) =>
  useQuery({
    queryKey: ["transcripts", geneId],
    queryFn: () => api.get<Transcript[]>(`/genes/${geneId}/transcripts`),
    enabled: geneId != null,
  })
