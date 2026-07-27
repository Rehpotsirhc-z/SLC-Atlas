// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type {
  DataSourceRecord,
  ExperimentalStructure,
  ProteinFeature,
  StructureRecord,
} from "@/types/structure"

export const useStructures = () =>
  useQuery({
    queryKey: ["structure"],
    queryFn: () => api.get<StructureRecord[]>("/structure"),
  })

export const useProteinFeatures = (geneId: string | null) =>
  useQuery({
    queryKey: ["structure", geneId, "features"],
    queryFn: () => api.get<ProteinFeature[]>(`/structure/${geneId}/features`),
    enabled: geneId != null,
  })

export const useExperimentalStructures = (geneId: string | null) =>
  useQuery({
    queryKey: ["structure", geneId, "experimental"],
    queryFn: () => api.get<ExperimentalStructure[]>(`/structure/${geneId}/experimental`),
    enabled: geneId != null,
  })

export const useStructureSources = () =>
  useQuery({
    queryKey: ["structure", "sources"],
    queryFn: () => api.get<DataSourceRecord[]>("/structure/sources"),
  })
