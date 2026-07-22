// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { doomColors, type ThemeMode } from "@/theme"

const ACCENT_HUES = [
  "red",
  "orange",
  "green",
  "teal",
  "yellow",
  "blue",
  "magenta",
  "violet",
  "cyan",
  "darkCyan",
] as const satisfies readonly (keyof (typeof doomColors)["dark"])[]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getFamilyColor(family: string, mode: ThemeMode): string {
  const hue = ACCENT_HUES[hashString(family) % ACCENT_HUES.length]
  return doomColors[mode][hue]
}
