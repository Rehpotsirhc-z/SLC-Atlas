// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ResidueSpan } from "./bindingSites"
import type { LigandTotal } from "./bindingSites"
import type { SiteModel } from "./chainModel"
import { TRACK } from "./constants"
import type { ResidueAxis } from "./residueAxis"

export interface SiteBar {
  key: string
  x: number
  width: number
}

export interface PlacedSite extends SiteModel {
  bars: SiteBar[]
  connectorFrom: number
  connectorTo: number
  y: number
  ligandIndex: number
}

const centre = (bar: SiteBar) => bar.x + bar.width / 2

export function placeSites(
  sites: SiteModel[],
  ligands: LigandTotal[],
  axis: ResidueAxis,
  top: number,
): PlacedSite[] {
  return sites.map((site, row) => {
    const bars = site.spans.map((s: ResidueSpan) => ({
      key: `${s.start}-${s.end}`,
      ...axis.boxFor(s.start, s.end, TRACK.siteBarMinWidth),
    }))
    return {
      ...site,
      bars,
      connectorFrom: centre(bars[0]),
      connectorTo: centre(bars[bars.length - 1]),
      y: top + row * TRACK.siteRow + TRACK.siteRow / 2,
      ligandIndex: ligands.findIndex((l) => l.name === site.ligand),
    }
  })
}
