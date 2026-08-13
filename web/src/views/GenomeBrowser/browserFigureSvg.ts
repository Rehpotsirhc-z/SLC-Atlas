// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Export the genome browser as SVG */

import type { CoverageArrays } from "@/api/bbi"
import { monoFontFamily, svgSansFontFamily } from "@/theme/fonts"
import type { CoverageTrack, GwasPoint, GwasStudy, TranscriptModel } from "@/types/browser"
import { esc } from "@/components/heatmap/figureSvg"
import {
  EXON_H,
  GENE_ROW_H,
  GENE_TRACK_PAD,
  GWAS_LANE_HEIGHT,
  GWAS_POINT_R,
  LANE_GAP,
  RULER_H,
  UTR_H,
  Y_HEADROOM,
} from "./constants"
import { columnPeaks } from "./drawCoverage"
import { arrowHead } from "./drawGenes"
import { gwasCeiling, SIGNIFICANCE_Y } from "./drawGwas"
import type { GeneSpan, TrackLayout } from "./geneLayout"
import { scaleFor, ticksFor, type Viewport } from "./scale"

const MARGIN = 20
const GUTTER = 168
const PLOT_W = 980
const TICK_GAP_PX = 92
const TITLE_PX = 16
const LABEL_PX = 12
const SUB_PX = 10.5

const svgMonoFontFamily = monoFontFamily.replace(/"/g, "&quot;")

export interface FigureLane {
  track: CoverageTrack
  color: string
  plus: CoverageArrays
  minus: CoverageArrays | null
}

export interface FigureInk {
  text: string
  muted: string
  axis: string
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
  gwasPoints: GwasPoint[]
  showGwas: boolean
  showSignificance: boolean
  transcripts: TrackLayout<TranscriptModel> | null
  genes: TrackLayout<GeneSpan> | null
  colorOf: (biotype: string | null) => string
  ink: FigureInk
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
  const scale = scaleFor(input.view, PLOT_W)
  const plusBuffer = new Float32Array(PLOT_W)
  const minusBuffer = new Float32Array(PLOT_W)
  const body: string[] = []
  const clips: string[] = []
  let y = 0
  let clipSeq = 0

  const label = (text: string, top: number, sub: string) =>
    `<text x="${GUTTER - 10}" y="${top + 12}" text-anchor="end" font-size="${LABEL_PX}" fill="${input.ink.text}">${esc(text)}</text>` +
    `<text x="${GUTTER - 10}" y="${top + 26}" text-anchor="end" font-size="${SUB_PX}" font-family="${svgMonoFontFamily}" fill="${input.ink.muted}">${esc(sub)}</text>`

  /** A lane's drawing, held inside its own box the way its canvas holds it. */
  const lane = (top: number, height: number, content: string) => {
    const id = `browser-clip-${clipSeq++}`
    clips.push(
      `<clipPath id="${id}"><rect x="0" y="0" width="${PLOT_W}" height="${height}"/></clipPath>`,
    )
    return `<g transform="translate(${GUTTER} ${top})" clip-path="url(#${id})">${content}</g>`
  }

  body.push(
    lane(
      y,
      RULER_H,
      `<line x1="0" y1="${RULER_H - 0.5}" x2="${PLOT_W}" y2="${RULER_H - 0.5}" stroke="${input.ink.axis}"/>` +
        ticksFor(scale, TICK_GAP_PX)
          .map(
            (tick) =>
              `<line x1="${tick.x.toFixed(1)}" y1="${RULER_H - 7}" x2="${tick.x.toFixed(1)}" y2="${RULER_H}" stroke="${input.ink.axis}"/>` +
              `<text x="${tick.x.toFixed(1)}" y="${RULER_H - 12}" text-anchor="middle" font-size="${LABEL_PX}" font-family="${svgMonoFontFamily}" fill="${input.ink.muted}">${esc(tick.label)}</text>`,
          )
          .join(""),
    ),
  )
  y += RULER_H + 8

  for (const item of input.lanes) {
    const height = input.laneHeight
    const stranded = item.minus !== null
    const baseline = stranded ? height / 2 : height
    const reach = stranded ? height / 2 : height

    const peakPlus = columnPeaks(plusBuffer, item.plus, scale)
    const peakMinus = item.minus ? columnPeaks(minusBuffer, item.minus, scale) : 0
    const seen = Math.max(peakPlus, peakMinus)
    const ceiling = input.yMax ?? (seen > 0 ? seen * Y_HEADROOM : 1)

    body.push(
      label(item.track.label, y, `${stranded ? "±" : ""}${ceiling.toFixed(2)}`) +
        lane(
          y,
          height,
          `<path d="${areaPath(plusBuffer, baseline, reach, ceiling, 1)}" fill="${item.color}"/>` +
            (item.minus
              ? `<path d="${areaPath(minusBuffer, baseline, reach, ceiling, -1)}" fill="${item.color}" fill-opacity="0.6"/>`
              : "") +
            `<line x1="0" y1="${baseline}" x2="${PLOT_W}" y2="${baseline}" stroke="${input.ink.axis}"/>`,
        ),
    )
    y += height + LANE_GAP
  }

  if (input.showGwas && input.study) {
    const max = gwasCeiling(input.gwasPoints, scale.start, scale.end)
    const overflowY = GWAS_POINT_R + 1
    const plotTop = overflowY * 2
    const toY = (value: number) => GWAS_LANE_HEIGHT - (value / max) * (GWAS_LANE_HEIGHT - plotTop)
    const dots = input.gwasPoints
      .filter((point) => point.position >= scale.start && point.position < scale.end)
      .map((point) => {
        const cy = point.neg_log10_p === null ? overflowY : toY(point.neg_log10_p)
        const fill =
          point.beta === null
            ? input.ink.muted
            : point.beta > 0
              ? input.ink.raised
              : input.ink.lowered
        return `<circle cx="${scale.toX(point.position).toFixed(1)}" cy="${cy.toFixed(1)}" r="${GWAS_POINT_R}" fill="${fill}"/>`
      })
      .join("")
    const rule =
      input.showSignificance && SIGNIFICANCE_Y <= max
        ? `<line x1="0" y1="${toY(SIGNIFICANCE_Y).toFixed(1)}" x2="${PLOT_W}" y2="${toY(SIGNIFICANCE_Y).toFixed(1)}" stroke="${input.ink.significance}" stroke-dasharray="4 3"/>`
        : ""
    body.push(
      label(input.study.trait, y, `-log10p <= ${max.toFixed(1)}`) +
        lane(
          y,
          GWAS_LANE_HEIGHT,
          `${rule}${dots}<line x1="0" y1="${GWAS_LANE_HEIGHT - 0.5}" x2="${PLOT_W}" y2="${GWAS_LANE_HEIGHT - 0.5}" stroke="${input.ink.axis}"/>`,
        ),
    )
    y += GWAS_LANE_HEIGHT + LANE_GAP
  }

  const track = input.transcripts ?? input.genes
  if (track) {
    const height = Math.max(track.rows, 1) * GENE_ROW_H + GENE_TRACK_PAD * 2
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
      // The same rule the canvas applies, so the file reads the way the page does
      const textLeft = left - 6 - text.length * LABEL_PX * 0.6
      if (textLeft > 0 && textLeft > (takenTo[row] ?? -Infinity) + 6) {
        marks.push(
          `<text x="${(left - 6).toFixed(1)}" y="${cy + 4}" text-anchor="end" font-size="${LABEL_PX}" font-family="${svgMonoFontFamily}" fill="${input.ink.muted}">${esc(text)}</text>`,
        )
      }
      takenTo[row] = right
    }
    body.push(label("Genes", y, `${track.items.length}`) + lane(y, height, marks.join("")))
    y += height
  }

  const width = GUTTER + PLOT_W + MARGIN * 2
  const titleBaseline = MARGIN + TITLE_PX
  const height = y + titleBaseline + MARGIN + 8
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${svgSansFontFamily}">` +
    `<defs>${clips.join("")}</defs>` +
    `<rect width="${width}" height="${height}" fill="${input.ink.background}"/>` +
    `<text x="${MARGIN}" y="${titleBaseline}" font-size="${TITLE_PX}" font-family="${svgMonoFontFamily}" font-weight="600" fill="${input.ink.text}">${esc(input.title)}</text>` +
    `<g transform="translate(${MARGIN} ${titleBaseline + 16})">${body.join("")}</g>` +
    `</svg>`
  )
}
