// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Export the genome browser as SVG

import type { CoverageArrays } from "@/api/bbi"
import { monoFontFamily, svgSansFontFamily } from "@/theme/fonts"
import type { VariantBlock } from "@/api/bbi"
import type { CoverageTrack, GwasStudy, TranscriptModel } from "@/types/browser"
import { esc } from "@/components/heatmap/figureSvg"
import {
  AXIS_TICK_PX,
  AXIS_W,
  CHEVRON_SPACING,
  EXON_H,
  GENE_ROW_H,
  GENE_TRACK_PAD,
  GWAS_LANE_HEIGHT,
  GROUP_GAP,
  GWAS_POINT_R,
  LANE_GAP,
  MINUS_ALPHA,
  RULER_H,
  RULER_LABEL_GAP_PX,
  RULER_TICK_GAP_PX,
  UTR_H,
  Y_HEADROOM,
} from "./constants"
import { columnPeaks } from "./drawCoverage"
import { arrowHead } from "./drawGenes"
import { firstFrom, GWAS_PLOT_TOP, gwasCeiling, SIGNIFICANCE_Y } from "./drawGwas"
import { countInView, type GeneSpan, type TrackLayout } from "./geneLayout"
import { rulerTicks, scaleFor, type Viewport } from "./scale"
import { axisMarks, formatSignal, yTicks } from "./yAxis"

const MARGIN = 20
const LABEL_W = 168
const GUTTER = LABEL_W + AXIS_W
export const FIGURE_FIXED_W = 980
const TITLE_PX = 16
const LABEL_PX = 12
const NAME_PX = 13
const GROUP_PX = 11
const SUB_PX = 11.5
const LABEL_LINE_H = 1.4
const AXIS_LABEL_PX = 10

interface LabelLine {
  text: string
  size: number
  fill: string
  mono?: boolean
  caps?: boolean
}

// Build a strand-chevron path that does not overlap exons
function chevronPath(
  from: number,
  to: number,
  y: number,
  forward: boolean,
  origin: number,
  exons: readonly { x: number; width: number }[],
): string {
  const reach = 3
  let ei = 0
  const segs: string[] = []
  for (
    let x = origin + Math.ceil((from - origin) / CHEVRON_SPACING) * CHEVRON_SPACING;
    x < to;
    x += CHEVRON_SPACING
  ) {
    if (x - reach < from) continue
    while (ei < exons.length && exons[ei].x + exons[ei].width < x - reach) ei++
    if (ei < exons.length && exons[ei].x <= x + reach) continue
    const back = x - (forward ? reach : -reach)
    const tip = x + (forward ? reach : -reach)
    segs.push(
      `M ${back.toFixed(1)} ${(y - reach).toFixed(1)} L ${tip.toFixed(1)} ${y.toFixed(1)} L ${back.toFixed(1)} ${(y + reach).toFixed(1)}`,
    )
  }
  return segs.join(" ")
}

const svgMonoFontFamily = monoFontFamily.replace(/"/g, "&quot;")

export interface FigureLane {
  track: CoverageTrack
  color: string
  plus: CoverageArrays
  minus: CoverageArrays | null
  absent: boolean
}

export interface FigureInk {
  text: string
  muted: string
  primary: string
  axis: string
  zero: string
  plot: string
  background: string
  raised: string
  lowered: string
  significance: string
  highlight: string
}

export interface FigureInput {
  view: Viewport
  chrom: string
  title: string
  lanes: FigureLane[]
  laneHeight: number
  yMax: number | null
  study: GwasStudy | null
  gwasBlock: VariantBlock
  showGwas: boolean
  showGrid: boolean
  showSignificance: boolean
  plotWidth: number
  transcripts: TrackLayout<TranscriptModel> | null
  genes: TrackLayout<GeneSpan> | null
  colorOf: (biotype: string | null) => string
  ink: FigureInk
}

function gridMarks(
  max: number,
  baseline: number,
  reach: number,
  stranded: boolean,
  color: string,
  plotW: number,
): string {
  return yTicks(max, reach)
    .map((value) => {
      const offset = (value / max) * reach
      const rows = stranded ? [baseline - offset, baseline + offset] : [baseline - offset]
      return rows
        .map(
          (at) =>
            `<line x1="0" y1="${at.toFixed(1)}" x2="${plotW}" y2="${at.toFixed(1)}" stroke="${color}" stroke-opacity="0.25"/>`,
        )
        .join("")
    })
    .join("")
}

function areaPath(peaks: Float32Array, baseline: number, reach: number, max: number, sign: 1 | -1) {
  const parts: string[] = [`M 0 ${baseline.toFixed(1)}`]
  for (let x = 0; x < peaks.length; x++) {
    const value = peaks[x]
    const y = value > 0 ? baseline - sign * (Math.min(value, max) / max) * reach : baseline
    parts.push(`L ${x} ${y.toFixed(1)}`, `L ${x + 1} ${y.toFixed(1)}`)
  }
  parts.push(`L ${peaks.length} ${baseline.toFixed(1)} Z`)
  return parts.join(" ")
}

export function buildBrowserFigureSvg(input: FigureInput): string {
  const PLOT_W = Math.max(1, Math.round(input.plotWidth))
  const scale = scaleFor(input.view, PLOT_W)
  const plusBuffer = new Float32Array(PLOT_W)
  const minusBuffer = new Float32Array(PLOT_W)
  const body: string[] = []
  const clips: string[] = []
  let y = 0
  let clipSeq = 0

  const lane = (top: number, height: number, content: string) => {
    const id = `browser-clip-${clipSeq++}`
    clips.push(
      `<clipPath id="${id}"><rect x="0" y="0" width="${PLOT_W}" height="${height}"/></clipPath>`,
    )
    return `<g transform="translate(${GUTTER} ${top})" clip-path="url(#${id})">${content}</g>`
  }

  const gutterLabel = (lines: LabelLine[], top: number, height: number, center: boolean) => {
    const total = lines.reduce((sum, line) => sum + line.size * LABEL_LINE_H, 0)
    let cursor = center ? (height - total) / 2 : GENE_TRACK_PAD
    const texts = lines
      .map((line) => {
        const baseline = cursor + line.size
        cursor += line.size * LABEL_LINE_H
        const text = line.caps ? line.text.toUpperCase() : line.text
        return (
          `<text x="0" y="${baseline.toFixed(1)}" font-size="${line.size}"` +
          (line.caps ? ' letter-spacing="0.7"' : "") +
          (line.mono ? ` font-family="${svgMonoFontFamily}"` : "") +
          ` fill="${line.fill}">${esc(text)}</text>`
        )
      })
      .join("")
    const id = `browser-clip-${clipSeq++}`
    clips.push(
      `<clipPath id="${id}"><rect x="0" y="0" width="${LABEL_W}" height="${height}"/></clipPath>`,
    )
    return `<g transform="translate(0 ${top})" clip-path="url(#${id})">${texts}</g>`
  }

  const surface = (height: number) =>
    `<rect x="0" y="0" width="${PLOT_W}" height="${height}" fill="${input.ink.plot}"/>`

  const axis = (
    top: number,
    height: number,
    max: number,
    stranded: boolean,
    span?: number,
    pinned: readonly number[] = [],
  ) => {
    const baseline = stranded ? height / 2 : height
    const reach = span ?? (stranded ? height / 2 : height)
    const marks: { at: number; text: string }[] = [{ at: baseline, text: "0" }]
    for (const { value, pinned: isPinned } of axisMarks(max, reach, pinned)) {
      const offset = (value / max) * reach
      const written = isPinned ? value.toFixed(2) : formatSignal(value)
      marks.push({ at: baseline - offset, text: stranded ? `+${formatSignal(value)}` : written })
      if (stranded) marks.push({ at: baseline + offset, text: `−${formatSignal(value)}` })
    }
    return (
      `<line x1="${GUTTER - 0.5}" y1="${top}" x2="${GUTTER - 0.5}" y2="${top + height}" stroke="${input.ink.axis}"/>` +
      marks
        .map(({ at, text }) => {
          const mark = top + at
          const written = Math.min(
            Math.max(mark, top + AXIS_LABEL_PX / 2),
            top + height - AXIS_LABEL_PX / 2,
          )
          return (
            `<line x1="${GUTTER - AXIS_TICK_PX}" y1="${mark.toFixed(1)}" x2="${GUTTER}" y2="${mark.toFixed(1)}" stroke="${input.ink.axis}"/>` +
            `<text x="${GUTTER - AXIS_TICK_PX - 3}" y="${(written + AXIS_LABEL_PX / 3).toFixed(1)}" text-anchor="end" font-size="${AXIS_LABEL_PX}" font-family="${svgMonoFontFamily}" fill="${input.ink.muted}">${esc(text)}</text>`
          )
        })
        .join("")
    )
  }

  const plotFrame = (top: number, height: number, skipTop = false) =>
    (skipTop
      ? ""
      : `<line x1="${GUTTER}" y1="${top - 0.5}" x2="${GUTTER + PLOT_W}" y2="${top - 0.5}" stroke="${input.ink.axis}"/>`) +
    `<line x1="${GUTTER}" y1="${top + height + 0.5}" x2="${GUTTER + PLOT_W}" y2="${top + height + 0.5}" stroke="${input.ink.axis}"/>` +
    `<line x1="${GUTTER + PLOT_W + 0.5}" y1="${top - 0.5}" x2="${GUTTER + PLOT_W + 0.5}" y2="${top + height + 0.5}" stroke="${input.ink.axis}"/>`

  body.push(
    lane(
      y,
      RULER_H,
      `<line x1="0" y1="${RULER_H - 0.5}" x2="${PLOT_W}" y2="${RULER_H - 0.5}" stroke="${input.ink.axis}"/>` +
        rulerTicks(
          scale,
          RULER_TICK_GAP_PX,
          RULER_LABEL_GAP_PX,
          (label) => label.length * LABEL_PX * 0.6,
        )
          .map(
            (tick) =>
              `<line x1="${tick.x.toFixed(1)}" y1="${RULER_H - 7}" x2="${tick.x.toFixed(1)}" y2="${RULER_H}" stroke="${input.ink.axis}"/>` +
              (tick.showLabel
                ? `<text x="${tick.labelX.toFixed(1)}" y="${RULER_H - 12}" text-anchor="middle" font-size="${LABEL_PX}" font-family="${svgMonoFontFamily}" fill="${input.ink.muted}">${esc(tick.label)}</text>`
                : ""),
          )
          .join(""),
    ),
  )
  y += RULER_H

  let openName = ""
  let firstOfAll = true

  for (const item of input.lanes) {
    const opensGroup = openName !== item.track.group
    if (opensGroup) {
      if (openName) y += GROUP_GAP
      openName = item.track.group
    }

    const height = input.laneHeight
    const stranded = item.minus !== null
    const baseline = stranded ? height / 2 : height
    const reach = stranded ? height / 2 : height

    const peakPlus = columnPeaks(plusBuffer, item.plus, scale)
    const peakMinus = item.minus ? columnPeaks(minusBuffer, item.minus, scale) : 0
    const seen = Math.max(peakPlus, peakMinus)
    const ceiling = input.yMax ?? (seen > 0 ? seen * Y_HEADROOM : 1)

    const laneLines: LabelLine[] = []
    if (opensGroup)
      laneLines.push({ text: openName, size: GROUP_PX, fill: input.ink.primary, caps: true })
    laneLines.push({
      text: item.track.label,
      size: NAME_PX,
      fill: item.absent ? input.ink.axis : input.ink.text,
    })
    if (!item.absent)
      laneLines.push({
        text: `peak signal ${formatSignal(seen)}`,
        size: SUB_PX,
        fill: input.ink.muted,
        mono: true,
      })

    body.push(
      gutterLabel(laneLines, y, height, true) +
        axis(y, height, ceiling, stranded) +
        lane(
          y,
          height,
          surface(height) +
            (input.showGrid
              ? gridMarks(ceiling, baseline, reach, stranded, input.ink.axis, PLOT_W)
              : "") +
            `<path d="${areaPath(plusBuffer, baseline, reach, ceiling, 1)}" fill="${item.color}"/>` +
            (item.minus
              ? `<path d="${areaPath(minusBuffer, baseline, reach, ceiling, -1)}" fill="${item.color}" fill-opacity="${MINUS_ALPHA}"/>`
              : "") +
            (stranded
              ? `<line x1="0" y1="${baseline}" x2="${PLOT_W}" y2="${baseline}" stroke="${input.ink.zero}"/>`
              : ""),
        ) +
        plotFrame(y, height, firstOfAll),
    )
    firstOfAll = false
    y += height + LANE_GAP
  }

  if (input.showGwas && input.study) {
    if (openName) y += GROUP_GAP
    const max = gwasCeiling(input.gwasBlock, scale.start, scale.end)
    const overflowY = GWAS_POINT_R + 1
    const toY = (value: number) =>
      GWAS_LANE_HEIGHT - (value / max) * (GWAS_LANE_HEIGHT - GWAS_PLOT_TOP)
    const { positions, values, betas } = input.gwasBlock
    const marks: string[] = []
    for (let i = firstFrom(input.gwasBlock, scale.start); i < positions.length; i++) {
      if (positions[i] >= scale.end) break
      const value = values[i]
      const cy = Number.isNaN(value) ? overflowY : toY(value)
      const beta = betas[i]
      const fill = Number.isNaN(beta)
        ? input.ink.muted
        : beta > 0
          ? input.ink.raised
          : input.ink.lowered
      marks.push(
        `<circle cx="${scale.toX(positions[i]).toFixed(1)}" cy="${cy.toFixed(1)}" r="${GWAS_POINT_R}" fill="${fill}"/>`,
      )
    }
    const dots = marks.join("")
    const rule =
      input.showSignificance && SIGNIFICANCE_Y <= max
        ? `<line x1="0" y1="${toY(SIGNIFICANCE_Y).toFixed(1)}" x2="${PLOT_W}" y2="${toY(SIGNIFICANCE_Y).toFixed(1)}" stroke="${input.ink.significance}" stroke-dasharray="4 3"/>`
        : ""
    const gwasLines: LabelLine[] = [
      { text: "GWAS", size: GROUP_PX, fill: input.ink.primary, caps: true },
      { text: input.study.trait, size: NAME_PX, fill: input.ink.text },
      { text: "−log10(p)", size: SUB_PX, fill: input.ink.muted, mono: true },
    ]
    body.push(
      gutterLabel(gwasLines, y, GWAS_LANE_HEIGHT, true) +
        axis(
          y,
          GWAS_LANE_HEIGHT,
          max,
          false,
          GWAS_LANE_HEIGHT - GWAS_PLOT_TOP,
          input.showSignificance && SIGNIFICANCE_Y <= max ? [SIGNIFICANCE_Y] : [],
        ) +
        lane(y, GWAS_LANE_HEIGHT, `${surface(GWAS_LANE_HEIGHT)}${rule}${dots}`) +
        plotFrame(y, GWAS_LANE_HEIGHT),
    )
    y += GWAS_LANE_HEIGHT + LANE_GAP
  }

  const track = input.transcripts ?? input.genes
  if (track) {
    const counts = countInView(track, input.view)
    const height = Math.max(counts.rows, 1) * GENE_ROW_H + GENE_TRACK_PAD * 2
    const marks: string[] = []
    const takenTo: number[] = []
    for (const { item, row } of track.items) {
      if (item.end < scale.start || item.start > scale.end) continue
      const cy = GENE_TRACK_PAD + row * GENE_ROW_H + GENE_ROW_H / 2
      const left = scale.toX(item.start)
      const right = scale.toX(item.end)
      const transcript = "transcript_id" in item ? item : null
      const span = transcript ? null : (item as GeneSpan)
      const color = span?.is_atlas_gene === true ? input.ink.highlight : input.colorOf(item.biotype)

      if (span) {
        const { tip, back, half } = arrowHead(left, right, span.strand !== "-")
        const stemFrom = span.strand !== "-" ? left : back
        const stemTo = span.strand !== "-" ? back : right
        if (stemTo > stemFrom) {
          marks.push(
            `<line x1="${stemFrom.toFixed(1)}" y1="${cy}" x2="${stemTo.toFixed(1)}" y2="${cy}" stroke="${color}"/>`,
          )
        }
        marks.push(
          `<polygon points="${tip.toFixed(1)},${cy} ${back.toFixed(1)},${(cy - half).toFixed(1)} ${back.toFixed(1)},${(cy + half).toFixed(1)}" fill="${color}"/>`,
        )
      }
      if (transcript) {
        marks.push(
          `<line x1="${left.toFixed(1)}" y1="${cy}" x2="${right.toFixed(1)}" y2="${cy}" stroke="${color}"/>`,
        )
        const exonBoxes = transcript.exons.map((exon) => scale.boxFor(exon.start, exon.end))
        const chevrons = chevronPath(
          Math.max(left, 0),
          Math.min(right, PLOT_W),
          cy,
          transcript.strand !== "-",
          left,
          exonBoxes,
        )
        if (chevrons) marks.push(`<path d="${chevrons}" fill="none" stroke="${color}"/>`)
        for (const exon of transcript.exons) {
          const coding =
            transcript.cds_start !== null && transcript.cds_end !== null
              ? {
                  start: Math.max(exon.start, transcript.cds_start),
                  end: Math.min(exon.end, transcript.cds_end),
                }
              : null
          const pieces =
            coding && coding.end > coding.start
              ? [
                  { start: exon.start, end: coding.start, tall: false },
                  { start: coding.start, end: coding.end, tall: true },
                  { start: coding.end, end: exon.end, tall: false },
                ].filter((piece) => piece.end > piece.start)
              : [{ start: exon.start, end: exon.end, tall: false }]
          for (const piece of pieces) {
            const box = scale.boxFor(piece.start, piece.end)
            const h = piece.tall ? EXON_H : UTR_H
            marks.push(
              `<rect x="${box.x.toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${box.width.toFixed(1)}" height="${h}" fill="${color}"/>`,
            )
          }
        }
      }

      const text = transcript ? transcript.gene_name || transcript.transcript_id : span!.label
      // Match the on-screen label placement
      const textLeft = left - 6 - text.length * LABEL_PX * 0.6
      if (textLeft > 0 && textLeft > (takenTo[row] ?? -Infinity) + 6) {
        marks.push(
          `<text x="${(left - 6).toFixed(1)}" y="${cy + 4}" text-anchor="end" font-size="${LABEL_PX}" font-family="${svgMonoFontFamily}" fill="${input.ink.muted}">${esc(text)}</text>`,
        )
      }
      takenTo[row] = right
    }
    const kind = input.transcripts ? "transcripts" : "genes"
    const geneLines: LabelLine[] = [{ text: "Genes", size: NAME_PX, fill: input.ink.text }]
    geneLines.push({
      text: `${counts.drawn} ${kind}`,
      size: SUB_PX,
      fill: input.ink.muted,
      mono: true,
    })
    if (counts.hidden > 0)
      geneLines.push({
        text: `${counts.hidden} hidden`,
        size: SUB_PX,
        fill: input.ink.muted,
        mono: true,
      })
    body.push(gutterLabel(geneLines, y, height, false) + lane(y, height, marks.join("")))
    y += height
  }

  const width = GUTTER + PLOT_W + MARGIN * 2
  const titleBaseline = MARGIN + TITLE_PX
  const height = y + titleBaseline + MARGIN + 8
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${svgSansFontFamily}">` +
    `<defs>${clips.join("")}</defs>` +
    `<rect width="${width}" height="${height}" fill="${input.ink.background}"/>` +
    `<text x="${MARGIN}" y="${titleBaseline}" font-size="${TITLE_PX}" font-family="${svgMonoFontFamily}" font-weight="600" fill="${input.ink.primary}">${esc(input.title)}</text>` +
    `<g transform="translate(${MARGIN} ${titleBaseline + 16})">${body.join("")}</g>` +
    `</svg>`
  )
}
