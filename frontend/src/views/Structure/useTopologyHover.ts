// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type MouseEvent } from "react"
import { spansOverlap } from "./bindingSites"
import type { ChainArc, MembraneCylinder, PlacedSite, TopologyLayout } from "./topologyLayout"

export type HoverTarget =
  | { kind: "segment"; item: MembraneCylinder }
  | { kind: "arc"; item: ChainArc }
  | { kind: "site"; item: PlacedSite }
  | { kind: "confidence"; residue: number; score: number }

export type Hover = HoverTarget & { x: number; y: number }

const DIM = 0.3

export function useTopologyHover(layout: TopologyLayout) {
  const [hover, setHover] = useState<Hover | null>(null)

  const track = (event: MouseEvent, target: HoverTarget) =>
    setHover({ ...target, x: event.clientX, y: event.clientY })
  const clear = () => setHover(null)

  // Hovering either half of the pairing lights up the other, so it is visible that a pocket
  // is assembled from particular helices
  const highlight = useMemo(() => {
    const segments = new Set<string>()
    const arcs = new Set<string>()
    const sites = new Set<string>()

    if (hover?.kind === "site") {
      sites.add(hover.item.key)
      const { spans } = hover.item
      for (const c of layout.cylinders) {
        if (spansOverlap(spans, c.start, c.end)) segments.add(c.key)
      }
      for (const arc of layout.arcs) {
        if (arc.residues && spansOverlap(spans, arc.start, arc.end)) arcs.add(arc.key)
      }
    } else if (hover?.kind === "segment" || hover?.kind === "arc") {
      const { start, end } = hover.item
      if (hover.kind === "segment") segments.add(hover.item.key)
      else arcs.add(hover.item.key)
      for (const site of layout.sites) {
        if (spansOverlap(site.spans, start, end)) sites.add(site.key)
      }
    }
    return { segments, arcs, sites, active: segments.size + arcs.size + sites.size > 0 }
  }, [hover, layout])

  const dimmed = (lit: boolean) => (highlight.active && !lit ? DIM : 1)

  return { hover, track, clear, highlight, dimmed }
}
