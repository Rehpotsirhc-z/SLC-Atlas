// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type {
  ExperimentalStructure,
  GeneTopology,
  ProteinFeature,
  StructureDetail,
  StructureRecord,
} from "@/types/structure"

export const useStructures = () =>
  useQuery({
    queryKey: ["structure"],
    queryFn: () => api.get<StructureRecord[]>("/structure.json"),
  })

export const useTopology = () =>
  useQuery({
    queryKey: ["structure", "topology"],
    queryFn: () => api.get<GeneTopology[]>("/structure/topology.json"),
  })

export const useStructureDetail = (geneId: string | null) =>
  useQuery({
    queryKey: ["structure", geneId, "detail"],
    queryFn: () => api.get<StructureDetail>(`/structure/${geneId}.json`),
    enabled: geneId != null,
  })

export const useProteinFeatures = (geneId: string | null) =>
  useQuery({
    queryKey: ["structure", geneId, "features"],
    queryFn: () => api.get<ProteinFeature[]>(`/structure/${geneId}/features.json`),
    enabled: geneId != null,
  })

export const useExperimentalStructures = (geneId: string | null) =>
  useQuery({
    queryKey: ["structure", geneId, "experimental"],
    queryFn: () => api.get<ExperimentalStructure[]>(`/structure/${geneId}/experimental.json`),
    enabled: geneId != null,
  })
