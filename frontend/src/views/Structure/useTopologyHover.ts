// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState, type MouseEvent } from "react"
import { mergeSpans, spansOverlap } from "./bindingSites"
import type { ChainArc, MembraneCylinder, PlacedSite, TopologyLayout } from "./topologyLayout"
import type { ResidueSpan } from "./molstar/types"

export type HoverTarget =
  | { kind: "segment"; item: MembraneCylinder }
  | { kind: "arc"; item: ChainArc }
  | { kind: "site"; item: PlacedSite }
  | { kind: "confidence"; residue: number; score: number }

export type Hover = HoverTarget & { x: number; y: number }

const DIM = 0.3

function spansOf(target: HoverTarget): ResidueSpan[] {
  if (target.kind === "site") return target.item.spans
  if (target.kind === "confidence") return [{ start: target.residue, end: target.residue }]
  return [{ start: target.item.start, end: target.item.end }]
}

export function useTopologyHover(layout: TopologyLayout) {
  const [hover, setHover] = useState<Hover | null>(null)
  const [focused, setFocused] = useState<HoverTarget | null>(null)

  const track = (event: MouseEvent, target: HoverTarget) =>
    setHover({ ...target, x: event.clientX, y: event.clientY })
  const clear = () => setHover(null)
  const select = useCallback((target: HoverTarget) => setFocused(target), [])
  const clearFocus = useCallback(() => setFocused(null), [])

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

  const highlightSpans = useMemo(() => {
    const spans: ResidueSpan[] = []
    for (const c of layout.cylinders) if (highlight.segments.has(c.key)) spans.push(c)
    for (const a of layout.arcs) if (highlight.arcs.has(a.key)) spans.push(a)
    for (const s of layout.sites) if (highlight.sites.has(s.key)) spans.push(...s.spans)
    return mergeSpans(spans)
  }, [highlight, layout])

  const focusSpans = useMemo(() => (focused ? mergeSpans(spansOf(focused)) : null), [focused])

  return {
    hover,
    track,
    clear,
    highlight,
    dimmed,
    focused,
    select,
    clearFocus,
    highlightSpans,
    focusSpans,
  }
}
