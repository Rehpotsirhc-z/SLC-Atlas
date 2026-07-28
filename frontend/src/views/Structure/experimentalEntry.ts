// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { RESOLUTION_DECIMALS } from "./constants"
import type { ExperimentalStructure } from "@/types/structure"

const METHOD_LABEL: Record<string, string> = {
  "ELECTRON MICROSCOPY": "cryo-EM",
  "X-RAY DIFFRACTION": "X-ray",
  "SOLUTION NMR": "NMR",
}

export function methodLabel(method: string | null): string | null {
  if (!method) return null
  return METHOD_LABEL[method] ?? method.toLowerCase()
}

export function resolutionLabel(resolution: number | null): string | null {
  return resolution != null ? `${resolution.toFixed(RESOLUTION_DECIMALS)} Å` : null
}

export function entryLabel(entry: ExperimentalStructure): string {
  const parts = [
    entry.pdb_id.toUpperCase(),
    methodLabel(entry.method),
    resolutionLabel(entry.resolution),
  ]
  return parts.filter(Boolean).join(" · ")
}
