// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { DataSourceRecord } from "@/types/structure"

export const useAllSources = () =>
  useQuery({
    queryKey: ["sources"],
    queryFn: () => api.get<DataSourceRecord[]>("/sources.json"),
    staleTime: Infinity,
  })
