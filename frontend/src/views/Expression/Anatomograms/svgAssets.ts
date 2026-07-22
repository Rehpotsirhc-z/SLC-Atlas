// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import brainSvg from "./anatomogram/homo_sapiens.brain.svg?raw"
import femaleSvg from "./anatomogram/homo_sapiens.female.svg?raw"
import maleSvg from "./anatomogram/homo_sapiens.male.svg?raw"
import type { RailView } from "./tissueMaps"

export const SVG_FOR: Record<RailView, string> = {
  female: femaleSvg,
  male: maleSvg,
  brain: brainSvg,
}

export function aspectRatioOf(view: RailView): number {
  const m = SVG_FOR[view].match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/)
  return m ? Number(m[1]) / Number(m[2]) : 1
}
