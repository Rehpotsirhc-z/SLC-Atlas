// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from "@tanstack/react-query"
import { api } from "../client"

// Which optional views the served dataset was built with
export const useCapabilities = () =>
  useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<Record<string, boolean>>("/capabilities.json"),
    staleTime: Infinity,
  })
