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
  | "family_grouping"

export type TreeMetric = "aa" | "dna" | "rna" | "ortho" | "family"
export type TreeTissue = "all" | "brain"

export const CLUSTER_METHOD: Record<string, ClusterMethod> = {
  aa: "aa_sequence",
  dna: "dna_sequence",
  "rna:all": "rna_coexpression_all",
  "rna:brain": "rna_coexpression_brain",
  ortho: "ortholog_identity",
  family: "family_grouping",
}

export const METRIC_ORDER: TreeMetric[] = ["aa", "dna", "rna", "ortho", "family"]

export const METRIC_LABEL: Record<TreeMetric, string> = {
  aa: "Amino acid",
  dna: "DNA",
  rna: "Co-expression",
  ortho: "Orthology",
  family: "Family",
}

export const METHOD_LABEL: Record<ClusterMethod, string> = {
  aa_sequence: "Amino-acid similarity",
  dna_sequence: "DNA (CDS) similarity",
  rna_coexpression_all: "RNA co-expression—all tissues",
  rna_coexpression_brain: "RNA co-expression—brain",
  ortholog_identity: "Ortholog identity similarity",
  family_grouping: "Grouped by family",
}

export interface AxisScale {
  label: string
  percent: boolean
}

export const AXIS_SCALE: Record<ClusterMethod, AxisScale> = {
  aa_sequence: { label: "Residues differing between two genes", percent: true },
  dna_sequence: { label: "Bases differing between two genes", percent: true },
  rna_coexpression_all: { label: "1 − Spearman correlation (expression)", percent: false },
  rna_coexpression_brain: { label: "1 − Spearman correlation (expression)", percent: false },
  ortholog_identity: { label: "1 − Spearman correlation (ortholog identity)", percent: false },
  family_grouping: { label: "", percent: false },
}

export function branchDistance(scale: AxisScale, branchLength: number): string | null {
  if (!scale.label) return null
  return scale.percent ? `${(branchLength * 100).toFixed(1)}%` : branchLength.toFixed(2)
}

export function resolveClusterMethod(metric: TreeMetric, tissue: TreeTissue): ClusterMethod {
  return metric === "rna" ? CLUSTER_METHOD[`rna:${tissue}`] : CLUSTER_METHOD[metric]
}

export const useClustering = (method: ClusterMethod) =>
  useQuery({
    queryKey: ["clustering", method],
    queryFn: () => api.get<ClusterNode[]>(`/clustering/${method}.json`),
  })
