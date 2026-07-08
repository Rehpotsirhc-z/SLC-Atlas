// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from "react"
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
import PsychologyIcon from "@mui/icons-material/Psychology"
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
  hit: SVGElement[] // elements that carry the mapped id and receive pointer events
  paint: SVGElement[] // shapes to fill
  present: boolean // tissue exists in the loaded data
}

interface FigureProps {
  svg: string
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  onPick: (tissue: string) => void
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

    const parts = new Map<string, PartEntry>()
    for (const [id, tissue] of Object.entries(idMap)) {
      const idEls = wrap.querySelectorAll<SVGElement>(`[id="${CSS.escape(id)}"]`)
      idEls.forEach((idEl) => {
        const hit = (
          idEl.tagName.toLowerCase() === "title" ? idEl.parentElement : idEl
        ) as SVGElement | null
        if (!hit) return
        const targets = fillTargets(hit)
        const present = presentTissues.has(tissue)
        if (present) {
          hit.dataset.tissue = tissue
          hit.style.pointerEvents = "auto"
          hit.style.cursor = "pointer"
          for (const t of targets) {
            t.style.pointerEvents = "auto"
            t.style.fill = colors.rest
            if (!reduceMotion) t.style.transition = "fill 300ms ease-out"
          }
        }
        const entry = parts.get(tissue) ?? { hit: [], paint: [], present }
        entry.hit.push(hit)
        entry.paint.push(...targets)
        entry.present = present
        parts.set(tissue, entry)
      })
    }
    partsRef.current = parts
    setBuilt((n) => n + 1)
  }, [svg, idMap, presentTissues, colors, reduceMotion])

  useEffect(() => {
    // Some tissues alias another's shape (e.g. cerebellar hemisphere and cerebellum), so resolve per-element instead of per-tissue
    const fills = new Map<SVGElement, string>()
    for (const [tissue, entry] of partsRef.current) {
      if (!entry.present) continue
      const fill = selectedTissue === tissue ? colors.selected : colors.rest
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
          if (tissue) onPick(tissue)
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
            {displayTissue(hover.tissue)}
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
  onPickSex: (sex: "female" | "male") => void
  onPickBrain: () => void
  onPickTissue: (tissue: string) => void
}

const SVG_FOR: Record<RailView, string> = {
  female: femaleSvg,
  male: maleSvg,
  brain: brainSvg,
}

export default function AnatomogramRail({
  view,
  presentTissues,
  selectedTissue,
  onPickSex,
  onPickBrain,
  onPickTissue,
}: RailProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box
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

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1.5, pb: 1.5 }}>
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
