// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from "react"
import { fillTargets, groupTpm, shapeKey, type PartEntry } from "./svgDom"
import { idToTissue, type RailView } from "./tissueMaps"
import type { AnatomogramColors } from "./useAnatomogramColors"

const SVG_NS = "http://www.w3.org/2000/svg"
const TINT_TRANSITION = "fill 300ms ease-out"

interface Options {
  svg: string
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  tpmByTissue: Map<string, number> | null
  colors: AnatomogramColors
  intensityFill: (tpm: number | null) => string
  reduceMotion: boolean
  fit: "width" | "contain"
  hoverTissue: string | null
}

export function useAnatomogramSvg({
  svg,
  view,
  presentTissues,
  selectedTissue,
  tpmByTissue,
  colors,
  intensityFill,
  reduceMotion,
  fit,
  hoverTissue,
}: Options) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const partsRef = useRef<Map<string, PartEntry>>(new Map())
  const [built, setBuilt] = useState(0)

  const idMap = useMemo(() => idToTissue(view), [view])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.innerHTML = svg
    const svgEl = wrap.querySelector("svg")
    if (!svgEl) return
    svgEl.removeAttribute("width")
    svgEl.removeAttribute("height")
    Object.assign(
      svgEl.style,
      fit === "contain"
        ? { maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }
        : { width: "100%", height: "auto", display: "block" },
    )

    const efo = wrap.querySelector<SVGGElement>("#LAYER_EFO")
    const outline = wrap.querySelector<SVGGElement>("#LAYER_OUTLINE")
    if (efo) svgEl.appendChild(efo)

    if (outline) {
      outline.style.opacity = String(colors.silhouetteOpacity)
      outline.style.fill = colors.base
      outline
        .querySelectorAll<SVGElement>("path, polygon, circle, ellipse, rect, g")
        .forEach((el) => {
          el.style.fill = colors.base
          el.style.fillOpacity = "1"
          el.style.opacity = "1"
          el.style.stroke = "none"
        })
    }

    efo?.querySelectorAll<SVGElement>("path, polygon, circle, ellipse, rect, use").forEach((el) => {
      el.style.fill = colors.idle
      el.style.stroke = "none"
      el.style.pointerEvents = "none"
    })

    const rawEntries: { tissue: string; hit: SVGElement }[] = []
    for (const [id, tissue] of Object.entries(idMap)) {
      wrap.querySelectorAll<SVGElement>(`[id="${CSS.escape(id)}"]`).forEach((idEl) => {
        const hit = (
          idEl.tagName.toLowerCase() === "title" ? idEl.parentElement : idEl
        ) as SVGElement | null
        if (hit) rawEntries.push({ tissue, hit })
      })
    }

    // With the shapes found, the titles would only add native browser tooltips
    wrap.querySelectorAll("title").forEach((t) => t.remove())

    // Tissues sharing one shape become a single hotspot
    const groupByShape = new Map<string, { tissue: string; hit: SVGElement }[]>()
    for (const entry of rawEntries) {
      const key = shapeKey(entry.hit)
      const group = groupByShape.get(key) ?? []
      group.push(entry)
      groupByShape.set(key, group)
    }

    const parts = new Map<string, PartEntry>()
    const canonicalHits = new Set<SVGElement>()
    const activeTargetIds = new Set<string>()
    let hideDefs: SVGElement | null = null

    for (const group of groupByShape.values()) {
      const canonical = group[0].hit
      const tissues = group.map((g) => g.tissue)
      const present = tissues.some((t) => presentTissues.has(t))
      const targets = fillTargets(wrap, canonical)

      if (present) {
        canonical.dataset.tissue = group[0].tissue
        canonical.style.pointerEvents = "auto"
        canonical.style.cursor = "pointer"
        for (const t of targets) {
          t.style.pointerEvents = "auto"
          t.style.fill = colors.rest
          if (!reduceMotion) t.style.transition = TINT_TRANSITION
        }
      }

      const entry: PartEntry = { paint: targets, present, tissues }
      for (const tissue of tissues) parts.set(tissue, entry)
      canonicalHits.add(canonical)

      const targetId = shapeKey(canonical)
      activeTargetIds.add(targetId)
      const base = wrap.querySelector<SVGElement>(`[id="${CSS.escape(targetId)}"]`)
      if (base && base !== canonical) {
        if (!hideDefs) {
          hideDefs =
            wrap.querySelector<SVGElement>("defs") ??
            svgEl.appendChild(document.createElementNS(SVG_NS, "defs"))
        }
        hideDefs.appendChild(base)
      }
    }

    efo?.querySelectorAll<SVGUseElement>("use").forEach((use) => {
      if (canonicalHits.has(use)) return
      if (activeTargetIds.has(shapeKey(use))) use.style.display = "none"
    })

    partsRef.current = parts
    setBuilt((n) => n + 1)
  }, [svg, idMap, presentTissues, colors, reduceMotion, fit])

  useEffect(() => {
    const fills = new Map<SVGElement, string>()
    const seen = new Set<PartEntry>()
    for (const entry of partsRef.current.values()) {
      if (seen.has(entry) || !entry.present) continue
      seen.add(entry)
      let fill: string
      if (selectedTissue !== null && entry.tissues.includes(selectedTissue)) {
        fill = colors.hover
      } else if (tpmByTissue) {
        fill = intensityFill(groupTpm(entry.tissues, tpmByTissue))
      } else {
        fill = colors.rest
      }
      for (const el of entry.paint) fills.set(el, fill)
    }
    if (hoverTissue) {
      const entry = partsRef.current.get(hoverTissue)
      if (entry?.present) for (const el of entry.paint) fills.set(el, colors.hover)
    }
    for (const [el, fill] of fills) el.style.fill = fill
  }, [built, hoverTissue, selectedTissue, colors, tpmByTissue, intensityFill])

  return { wrapRef, partsRef }
}
