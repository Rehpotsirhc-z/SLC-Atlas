// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { confidenceColor } from "./confidenceColor"
import type { Bead } from "./residuesLayout"

export interface BeadInk {
  chain: string
  edge: string
  neutralFill: string
  neutralInk: string
  label: string
  lit: string
  letterInk: Record<string, string>
  ligand: (index: number) => string
}

export const beadFill = (bead: Bead, ink: BeadInk) =>
  bead.score === null ? ink.neutralFill : confidenceColor(bead.score)

export const beadLetterInk = (bead: Bead, ink: BeadInk) =>
  bead.score === null ? ink.neutralInk : ink.letterInk[confidenceColor(bead.score)]
