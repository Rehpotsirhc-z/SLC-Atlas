// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ThemeMode } from "@/theme"

/**
 * A hue per cell type, spread evenly around the wheel.
 *
 * Keyed on the label rather than on the track, so the same cell type keeps its color in
 * every assay it appears in and a reader can follow one across the groups. The named palette
 * is not used here because a dataset can carry more cell types than it has names.
 */
const SATURATION = 62
const LIGHTNESS: Record<ThemeMode, number> = { dark: 62, light: 40 }

export function trackColors(labels: string[], mode: ThemeMode): Map<string, string> {
  const distinct = [...new Set(labels)]
  const out = new Map<string, string>()
  distinct.forEach((label, index) => {
    const hue = Math.round((index * 360) / Math.max(distinct.length, 1))
    // Commas rather than the modern spacing: alpha() splits hsl on commas, and a color it
    // cannot read comes back with undefined channels that canvas then ignores outright
    out.set(label, `hsl(${hue}, ${SATURATION}%, ${LIGHTNESS[mode]}%)`)
  })
  return out
}
