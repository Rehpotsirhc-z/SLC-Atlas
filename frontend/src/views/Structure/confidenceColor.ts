// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from "react"
import { useTheme } from "@mui/material"
import { lerpHex } from "@/utils/tpmColor"

// pLDDT is a 0-100 score, so the ramp spans the whole range
const DOMAIN_MAX = 100

// The paper-to-accent ramp the other heatmaps use, in secondary so it reads as its own metric
export function useConfidenceColor() {
  const { palette } = useTheme()
  const from = palette.background.paper
  const to = palette.secondary.main

  return useCallback((score: number) => lerpHex(from, to, score / DOMAIN_MAX), [from, to])
}
