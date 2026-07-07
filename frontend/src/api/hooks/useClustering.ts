// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { ClusterNode } from "@/types/clustering"

export type ClusterMethod =
  | "aa_sequence"
  | "dna_sequence"
  | "rna_coexpression_all"
  | "rna_coexpression_brain"
  | "ortholog_identity"

export type TreeMetric = "aa" | "dna" | "rna" | "ortho"
export type TreeTissue = "all" | "brain"

export const CLUSTER_METHOD: Record<string, ClusterMethod> = {
  aa: "aa_sequence",
  dna: "dna_sequence",
  "rna:all": "rna_coexpression_all",
  "rna:brain": "rna_coexpression_brain",
  ortho: "ortholog_identity",
}

export const METRIC_ORDER: TreeMetric[] = ["aa", "dna", "rna", "ortho"]

export const METRIC_LABEL: Record<TreeMetric, string> = {
  aa: "Amino acid",
  dna: "DNA",
  rna: "Co-expression",
  ortho: "Orthology",
}

export function resolveClusterMethod(metric: TreeMetric, tissue: TreeTissue): ClusterMethod {
  return metric === "rna" ? CLUSTER_METHOD[`rna:${tissue}`] : CLUSTER_METHOD[metric]
}

export const useClustering = (method: ClusterMethod) =>
  useQuery({
    queryKey: ["clustering", method],
    queryFn: () => api.get<ClusterNode[]>(`/clustering?method=${method}`),
  })
