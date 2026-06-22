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

export const useClustering = (method: ClusterMethod) =>
  useQuery({
    queryKey: ["clustering", method],
    queryFn: () => api.get<ClusterNode[]>(`/clustering?method=${method}`),
  })
