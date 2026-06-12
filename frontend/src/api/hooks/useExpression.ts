import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { ExpressionRow } from "../../types/expression"

export const useExpression = (geneId: string | null, modality: "rna" | "protein" = "rna") =>
  useQuery({
    queryKey: ["expression", geneId, modality],
    queryFn: () => api.get<ExpressionRow[]>(`/expression?gene_id=${geneId}&modality=${modality}`),
    enabled: geneId != null,
  })
