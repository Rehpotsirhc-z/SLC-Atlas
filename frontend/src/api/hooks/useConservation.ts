// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"
import type { ConservationCell, SpeciesNode } from "@/types/conservation"

export const useConservation = () =>
  useQuery({
    queryKey: ["conservation"],
    queryFn: () => api.get<ConservationCell[]>("/conservation"),
  })

export const useSpeciesTree = () =>
  useQuery({
    queryKey: ["conservation", "species-tree"],
    queryFn: () => api.get<SpeciesNode[]>("/conservation/species-tree"),
  })
