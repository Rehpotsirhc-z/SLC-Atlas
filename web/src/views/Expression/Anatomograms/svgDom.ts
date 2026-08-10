// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

const SHAPE_SEL = "path, polygon, circle, ellipse, rect"

export interface PartEntry {
  tissues: string[] // every mapped tissue that renders this exact shape
  paint: SVGElement[] // shapes to fill
  present: boolean // at least one of `tissues` exists in the loaded data
}

// Merged hotspots render one shape for several tissues, so just average whichever of them have data
export function groupTpm(tissues: string[], tpmByTissue: Map<string, number>): number | null {
  const vals = tissues.map((t) => tpmByTissue.get(t)).filter((v): v is number => v !== undefined)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function resolveUse(wrap: HTMLElement, el: SVGElement): SVGElement[] {
  const href = el.getAttribute("href") ?? el.getAttribute("xlink:href")
  if (href?.startsWith("#")) {
    const t = wrap.querySelector<SVGElement>(`[id="${CSS.escape(href.slice(1))}"]`)
    if (t)
      return t.tagName.toLowerCase() === "g"
        ? Array.from(t.querySelectorAll<SVGElement>(SHAPE_SEL))
        : [t]
  }
  return [el]
}

export function fillTargets(wrap: HTMLElement, el: SVGElement): SVGElement[] {
  const tag = el.tagName.toLowerCase()
  if (tag === "use") return resolveUse(wrap, el)
  if (tag === "g")
    return Array.from(el.querySelectorAll<SVGElement>(`${SHAPE_SEL}, use`)).flatMap((c) =>
      c.tagName.toLowerCase() === "use" ? resolveUse(wrap, c) : [c],
    )
  return [el]
}

export function shapeKey(el: SVGElement): string {
  if (el.tagName.toLowerCase() === "use") {
    const href = el.getAttribute("href") ?? el.getAttribute("xlink:href")
    if (href?.startsWith("#")) return href.slice(1)
  }
  return el.id
}

/** Smallest hotspot under the cursor, so nested organs win over the body outline */
export function tissueAt(wrap: HTMLElement, clientX: number, clientY: number): string | null {
  let best: string | null = null
  let bestArea = Infinity
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const hit = (el as Element).closest?.("[data-tissue]") as SVGGraphicsElement | null
    if (!hit || !wrap.contains(hit)) continue
    let area = Infinity
    try {
      const b = hit.getBBox()
      area = b.width * b.height
    } catch {
      /* Not laid out */
    }
    if (area < bestArea) {
      bestArea = area
      best = hit.dataset.tissue ?? null
    }
  }
  return best
}
