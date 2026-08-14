// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { doomColors, type ThemeMode } from "@/theme"

// Blue clashes with the helix pills, and the confidence bands below take blue, cyan,
// yellow and orange
const LIGAND_HUES = ["magenta", "green", "violet", "red", "teal", "darkCyan"] as const

// Assigned by list position rather than hashed, so no gene in the family repeats a color
export function ligandColorAt(index: number, mode: ThemeMode): string {
  return doomColors[mode][LIGAND_HUES[index % LIGAND_HUES.length]]
}
