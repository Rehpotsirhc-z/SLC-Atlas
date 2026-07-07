// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { ExpressionRow } from "../../types/expression"

export const useExpressionMatrix = (tissueScope: "all" | "brain") =>
  useQuery({
    queryKey: ["expression", "matrix", tissueScope],
    queryFn: () => api.get<ExpressionRow[]>(`/expression?tissue_scope=${tissueScope}`),
  })
