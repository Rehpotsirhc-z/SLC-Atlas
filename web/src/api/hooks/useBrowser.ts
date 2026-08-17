// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { BrowserGene, Region, TrackManifest } from "@/types/browser"
import type { DataSourceRecord } from "@/types/structure"

export const useTrackManifest = () =>
  useQuery({
    queryKey: ["browser", "tracks"],
    queryFn: () => api.get<TrackManifest>("/browser/tracks.json"),
    staleTime: Infinity,
  })

export const useBrowserGenes = () =>
  useQuery({
    queryKey: ["browser", "genes"],
    queryFn: () => api.get<BrowserGene[]>("/browser/genes.json"),
    staleTime: Infinity,
  })

export const useRegion = (geneId: string | null) =>
  useQuery({
    queryKey: ["browser", geneId, "region"],
    queryFn: () => api.get<Region>(`/browser/${geneId}/region.json`),
    enabled: geneId != null,
  })

export const useBrowserSources = () =>
  useQuery({
    queryKey: ["browser", "sources"],
    queryFn: () => api.get<DataSourceRecord[]>("/browser/sources.json"),
  })
