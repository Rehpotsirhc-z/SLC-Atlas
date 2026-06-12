// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { ExpressionRow } from "../../types/expression"

export const useExpression = (geneId: string | null, modality: "rna" | "protein" = "rna") =>
  useQuery({
    queryKey: ["expression", geneId, modality],
    queryFn: () => api.get<ExpressionRow[]>(`/expression?gene_id=${geneId}&modality=${modality}`),
    enabled: geneId != null,
  })
