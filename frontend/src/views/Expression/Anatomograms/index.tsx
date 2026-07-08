// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import PsychologyIcon from "@mui/icons-material/Psychology"
import FemaleIcon from "@mui/icons-material/Female"
import MaleIcon from "@mui/icons-material/Male"
import { RAIL_MIN_WIDTH } from "@/store/uiStore"
import { displayTissue } from "@/utils/tissue"
import femaleSvg from "./anatomogram/homo_sapiens.female.svg?raw"
import maleSvg from "./anatomogram/homo_sapiens.male.svg?raw"
import brainSvg from "./anatomogram/homo_sapiens.brain.svg?raw"

export type RailView = "female" | "male" | "brain"

// GTEx tissue map to anatomogram element id
const BODY_MAP: Record<string, string> = {
  "Adipose Tissue": "UBERON_0001013",
  "Adrenal Gland": "UBERON_0002369",
  Bladder: "UBERON_0001255",
  Blood: "UBERON_0000178",
  "Blood Vessel": "UBERON_0001981",
  Brain: "UBERON_0000955",
  Breast: "UBERON_0000310",
  Colon: "UBERON_0001155",
  Esophagus: "UBERON_0001043",
  Heart: "UBERON_0000948",
  Kidney: "UBERON_0002113",
  Liver: "UBERON_0002107",
  Lung: "UBERON_0002048",
  Muscle: "UBERON_0001134",
  Nerve: "UBERON_0001021",
  Pancreas: "UBERON_0001264",
  Pituitary: "UBERON_0000007",
  "Salivary Gland": "UBERON_0001044",
  Skin: "UBERON_0000014",
  "Small Intestine": "UBERON_0002108",
  Spleen: "UBERON_0002106",
  Stomach: "UBERON_0000945",
  Thyroid: "UBERON_0002046",
  // male-only
  Prostate: "UBERON_0002367",
  Testis: "UBERON_0000473",
  // female-only
  "Cervix Uteri": "UBERON_0000002",
  "Fallopian Tube": "UBERON_0003889",
  Ovary: "UBERON_0000992",
  Uterus: "UBERON_0000995",
  Vagina: "UBERON_0000996",
}

// GTEx Brain tissue map to anatomogram named region id
const BRAIN_MAP: Record<string, string> = {
  "Brain - Amygdala": "amygdala",
  "Brain - Anterior cingulate cortex (BA24)": "cingulate_cortex",
  "Brain - Caudate (basal ganglia)": "caudate_nucleus",
  "Brain - Cerebellar Hemisphere": "cerebellar_hemisphere",
  "Brain - Cerebellum": "cerebellum",
  "Brain - Cortex": "cerebral_cortex",
  "Brain - Frontal Cortex (BA9)": "frontal_cortex",
  "Brain - Hippocampus": "hippocampus",
  "Brain - Hypothalamus": "hypothalamus",
  "Brain - Nucleus accumbens (basal ganglia)": "nucleus_accumbens",
  "Brain - Putamen (basal ganglia)": "putamen",
  "Brain - Spinal cord (cervical c-1)": "medulla_oblongata",
  "Brain - Substantia nigra": "substantia_nigra",
}

function idToTissue(view: RailView): Record<string, string> {
  const src = view === "brain" ? BRAIN_MAP : BODY_MAP
  const out: Record<string, string> = {}
  for (const [tissue, id] of Object.entries(src)) out[id] = tissue
  return out
}

interface PartEntry {
  tissues: string[] // every mapped tissue that renders this exact shape
  paint: SVGElement[] // shapes to fill
  present: boolean // at least one of `tissues` exists in the loaded data
}

interface FigureProps {
  svg: string
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  onPick: (tissues: string[]) => void
}

function AnatomogramFigure({ svg, view, presentTissues, selectedTissue, onPick }: FigureProps) {
  const theme = useTheme()
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const wrapRef = useRef<HTMLDivElement>(null)
  const partsRef = useRef<Map<string, PartEntry>>(new Map())
  const [built, setBuilt] = useState(0)
  const [hover, setHover] = useState<{ tissue: string; x: number; y: number } | null>(null)

  const idMap = useMemo(() => idToTissue(view), [view])

  const colors = useMemo(() => {
    const base = theme.palette.text.primary
    return {
      base,
      silhouetteOpacity: theme.palette.mode === "dark" ? 0.34 : 0.28,
      idle: "transparent",
      rest: alpha(base, theme.palette.mode === "dark" ? 0.16 : 0.13),
      hover: alpha(theme.palette.primary.main, 0.6),
      selected: theme.palette.primary.main,
      attribution: theme.palette.text.secondary,
      attributionDisc: alpha(theme.palette.text.secondary, 0.16),
    }
  }, [theme])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.innerHTML = svg
    const svgEl = wrap.querySelector("svg")
    if (!svgEl) return
    svgEl.removeAttribute("width")
    svgEl.removeAttribute("height")
    Object.assign(svgEl.style, { width: "100%", height: "auto", display: "block" })

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
      delete el.dataset.tissue
    })

    const attribution = wrap.querySelector<SVGAElement>("a")
    if (attribution) {
      svgEl.appendChild(attribution)
      attribution.setAttribute("target", "_blank")
      attribution.setAttribute("rel", "noopener noreferrer")
      attribution.style.opacity = "1"
      attribution.style.pointerEvents = "auto"
      attribution.style.cursor = "pointer"
      attribution.querySelectorAll<SVGElement>("*").forEach((el) => {
        el.style.fill = colors.attribution
        el.style.fillOpacity = "1"
        el.style.opacity = "1"
      })
      const disc = attribution.querySelector<SVGElement>("circle")
      if (disc) disc.style.fill = colors.attributionDisc
    }

    const SHAPE_SEL = "path, polygon, circle, ellipse, rect"

    const resolveUse = (el: SVGElement): SVGElement[] => {
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
    const fillTargets = (el: SVGElement): SVGElement[] => {
      const tag = el.tagName.toLowerCase()
      if (tag === "use") return resolveUse(el)
      if (tag === "g")
        return Array.from(el.querySelectorAll<SVGElement>(`${SHAPE_SEL}, use`)).flatMap((c) =>
          c.tagName.toLowerCase() === "use" ? resolveUse(c) : [c],
        )
      return [el]
    }

    const shapeKey = (el: SVGElement): string => {
      if (el.tagName.toLowerCase() === "use") {
        const href = el.getAttribute("href") ?? el.getAttribute("xlink:href")
        if (href?.startsWith("#")) return href.slice(1)
      }
      return el.id
    }

    // Group tissues with same shape into one interactive hotspot
    const rawEntries: { tissue: string; hit: SVGElement }[] = []
    for (const [id, tissue] of Object.entries(idMap)) {
      wrap.querySelectorAll<SVGElement>(`[id="${CSS.escape(id)}"]`).forEach((idEl) => {
        const hit = (
          idEl.tagName.toLowerCase() === "title" ? idEl.parentElement : idEl
        ) as SVGElement | null
        if (hit) rawEntries.push({ tissue, hit })
      })
    }

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
      const targets = fillTargets(canonical)

      if (present) {
        canonical.dataset.tissue = group[0].tissue
        canonical.style.pointerEvents = "auto"
        canonical.style.cursor = "pointer"
        for (const t of targets) {
          t.style.pointerEvents = "auto"
          t.style.fill = colors.rest
          if (!reduceMotion) t.style.transition = "fill 300ms ease-out"
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
            svgEl.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "defs"))
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
  }, [svg, idMap, presentTissues, colors, reduceMotion])

  useEffect(() => {
    const fills = new Map<SVGElement, string>()
    const seen = new Set<PartEntry>()
    for (const entry of partsRef.current.values()) {
      if (seen.has(entry) || !entry.present) continue
      seen.add(entry)
      const fill =
        selectedTissue !== null && entry.tissues.includes(selectedTissue)
          ? colors.selected
          : colors.rest
      for (const el of entry.paint) fills.set(el, fill)
    }
    if (hover) {
      const entry = partsRef.current.get(hover.tissue)
      if (entry?.present) for (const el of entry.paint) fills.set(el, colors.hover)
    }
    for (const [el, fill] of fills) el.style.fill = fill
  }, [built, hover, selectedTissue, colors])

  function tissueAt(e: React.MouseEvent): string | null {
    const wrap = wrapRef.current
    if (!wrap) return null
    let best: string | null = null
    let bestArea = Infinity
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const hit = (el as Element).closest?.("[data-tissue]") as SVGGraphicsElement | null
      if (!hit || !wrap.contains(hit)) continue
      let area = Infinity
      try {
        const b = hit.getBBox()
        area = b.width * b.height
      } catch {
        /* not laid out */
      }
      if (area < bestArea) {
        bestArea = area
        best = hit.dataset.tissue ?? null
      }
    }
    return best
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box
        ref={wrapRef}
        sx={{ width: "100%" }}
        onMouseMove={(e) => {
          const tissue = tissueAt(e)
          const rect = wrapRef.current?.getBoundingClientRect()
          if (tissue && rect)
            setHover({ tissue, x: e.clientX - rect.left, y: e.clientY - rect.top })
          else if (hover) setHover(null)
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const tissue = tissueAt(e)
          if (!tissue) return
          const tissues = (partsRef.current.get(tissue)?.tissues ?? [tissue]).filter((t) =>
            presentTissues.has(t),
          )
          if (tissues.length) onPick(tissues)
        }}
      />
      {hover && (
        <Box
          sx={{
            position: "absolute",
            left: hover.x + 12,
            top: hover.y + 12,
            pointerEvents: "none",
            zIndex: 5,
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            px: 1,
            py: 0.25,
            boxShadow: 3,
            maxWidth: 220,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            {(partsRef.current.get(hover.tissue)?.tissues ?? [hover.tissue])
              .map(displayTissue)
              .join(", ")}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

interface RailProps {
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  maxWidth: number
  onAutoWidth: (px: number) => void
  onFillWidth: (px: number) => void
  onPickSex: (sex: "female" | "male") => void
  onPickBrain: () => void
  onPickTissue: (tissues: string[]) => void
}

const SVG_FOR: Record<RailView, string> = {
  female: femaleSvg,
  male: maleSvg,
  brain: brainSvg,
}

function getAspectRatio(svg: string): number {
  const m = svg.match(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/)
  return m ? Number(m[1]) / Number(m[2]) : 1
}

export default function AnatomogramRail({
  view,
  presentTissues,
  selectedTissue,
  maxWidth,
  onAutoWidth,
  onFillWidth,
  onPickSex,
  onPickBrain,
  onPickTissue,
}: RailProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const figureWrapRef = useRef<HTMLDivElement>(null)
  const aspectRatio = useMemo(() => getAspectRatio(SVG_FOR[view]), [view])

  useLayoutEffect(() => {
    const root = rootRef.current
    const header = headerRef.current
    const figureWrap = figureWrapRef.current
    if (!root || !header || !figureWrap) return

    const figureStyle = getComputedStyle(figureWrap)
    const padX = parseFloat(figureStyle.paddingLeft) + parseFloat(figureStyle.paddingRight)
    const padY = parseFloat(figureStyle.paddingTop) + parseFloat(figureStyle.paddingBottom)

    function recompute() {
      if (!root || !header) return
      // Small padding
      const SAFETY_PX = 2
      const availableFigureH = Math.max(
        0,
        root.clientHeight - header.offsetHeight - padY - SAFETY_PX,
      )
      const fillWidth = availableFigureH * aspectRatio + padX
      onFillWidth(Math.round(Math.max(fillWidth, RAIL_MIN_WIDTH)))
      onAutoWidth(Math.round(Math.min(Math.max(fillWidth, RAIL_MIN_WIDTH), maxWidth)))
    }

    recompute()
    let lastHeight = root.clientHeight
    const ro = new ResizeObserver(() => {
      if (root.clientHeight !== lastHeight) {
        lastHeight = root.clientHeight
        recompute()
      }
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [aspectRatio, maxWidth, onAutoWidth, onFillWidth])

  return (
    <Box
      ref={rootRef}
      sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <Box
        ref={headerRef}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          px: 1.5,
          py: 1.5,
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view === "brain" ? null : view}
          onChange={(_, v) => v && onPickSex(v)}
        >
          <ToggleButton value="female" sx={{ px: 1.5 }}>
            <Tooltip title="Female body" arrow>
              <FemaleIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="male" sx={{ px: 1.5 }}>
            <Tooltip title="Male body" arrow>
              <MaleIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButton
          size="small"
          value="brain"
          selected={view === "brain"}
          onChange={() => onPickBrain()}
          sx={{ px: 1.5, gap: 0.5 }}
        >
          <PsychologyIcon fontSize="small" />
        </ToggleButton>
      </Box>

      <Box
        ref={figureWrapRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: 1.5,
          pb: 1.5,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <AnatomogramFigure
          key={view}
          svg={SVG_FOR[view]}
          view={view}
          presentTissues={presentTissues}
          selectedTissue={selectedTissue}
          onPick={onPickTissue}
        />
      </Box>
    </Box>
  )
}
