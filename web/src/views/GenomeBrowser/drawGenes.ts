// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Draw transcript or gene models on a canvas

import type { TranscriptModel } from "@/types/browser"
import {
  ARROW_H,
  ARROW_MIN_H,
  CANVAS_LABEL_PX,
  CHEVRON_SPACING,
  EXON_H,
  GENE_ROW_H,
  LABEL_GAP_PX,
  LABEL_MIN_PX,
  UTR_H,
} from "./constants"
import type { GeneSpan, TrackLayout } from "./geneLayout"
import type { Scale } from "./scale"

export interface GeneInk {
  colorOf: (biotype: string | null) => string
  label: string
  font: string
  // Label widths cached by font weight and text
  widths: Map<string, number>
}

// Align row centers to half pixels for crisp one-pixel strokes
const rowCentre = (row: number, top: number) =>
  Math.floor(top + row * GENE_ROW_H + GENE_ROW_H / 2) + 0.5

export interface ArrowHead {
  tip: number
  back: number
  half: number
}

// Keep arrowheads odd-sized and let narrow genes overhang away from their labels
export function arrowHead(left: number, right: number, forward: boolean): ArrowHead {
  const room = Math.round(right - left)
  const size = Math.min(ARROW_H, Math.max(ARROW_MIN_H, room))
  const head = size % 2 === 0 ? size - 1 : size
  const tip = Math.round(forward ? Math.max(right, left + head) : left)
  return { tip, back: forward ? tip - head : tip + head, half: head / 2 }
}

// Draw strand chevrons relative to the feature, skipping exons
function chevrons(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  y: number,
  forward: boolean,
  origin: number,
  exons: readonly { x: number; width: number }[],
) {
  const reach = 3
  let ei = 0
  let drawn = false
  ctx.beginPath()
  for (
    let x = origin + Math.ceil((from - origin) / CHEVRON_SPACING) * CHEVRON_SPACING;
    x < to;
    x += CHEVRON_SPACING
  ) {
    if (x - reach < from) continue
    while (ei < exons.length && exons[ei].x + exons[ei].width < x - reach) ei++
    if (ei < exons.length && exons[ei].x <= x + reach) continue
    ctx.moveTo(x - (forward ? reach : -reach), y - reach)
    ctx.lineTo(x + (forward ? reach : -reach), y)
    ctx.lineTo(x - (forward ? reach : -reach), y + reach)
    drawn = true
  }
  if (drawn) ctx.stroke()
}

// Draw a label when it fits before the model without overlapping the row
function labelBefore(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bold: boolean,
  ink: GeneInk,
  takenTo: number,
): boolean {
  if (x < LABEL_MIN_PX) return false
  const face = `${bold ? 700 : 400} ${CANVAS_LABEL_PX}px ${ink.font}`
  // Cache measurements because this runs on every frame while dragging
  const key = `${bold ? "b" : "r"}\u0000${text}`
  let measured = ink.widths.get(key)
  if (measured === undefined) {
    ctx.font = face
    measured = ctx.measureText(text).width
    ink.widths.set(key, measured)
  }
  const left = x - LABEL_GAP_PX - measured
  if (left < 0 || left < takenTo + LABEL_GAP_PX) return false
  ctx.font = face
  ctx.fillStyle = ink.label
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  ctx.fillText(text, x - LABEL_GAP_PX, y)
  return true
}

export interface TranscriptFrame {
  ctx: CanvasRenderingContext2D
  scale: Scale
  height: number
  top: number
  layout: TrackLayout<TranscriptModel>
  ink: GeneInk
}

export function drawTranscripts({ ctx, scale, height, top, layout, ink }: TranscriptFrame) {
  ctx.clearRect(0, 0, scale.width, height)
  ctx.lineWidth = 1
  // Track occupied space in each row to prevent label overlap
  const takenTo: number[] = []

  for (const { item, row } of layout.items) {
    // Items are ordered by start position
    if (item.start > scale.end) break
    if (item.end < scale.start) continue
    const y = rowCentre(row, top)
    const color = ink.colorOf(item.biotype)
    const left = scale.toX(item.start)
    const right = scale.toX(item.end)

    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
    const exonBoxes = item.exons.map((e) => scale.boxFor(e.start, e.end))
    chevrons(
      ctx,
      Math.max(left, 0),
      Math.min(right, scale.width),
      y,
      item.strand !== "-",
      left,
      exonBoxes,
    )

    ctx.fillStyle = color
    for (const exon of item.exons) {
      // Draw coding regions taller than UTRs, even when both share an exon
      const coding =
        item.cds_start !== null && item.cds_end !== null
          ? { start: Math.max(exon.start, item.cds_start), end: Math.min(exon.end, item.cds_end) }
          : null
      const parts: { start: number; end: number; tall: boolean }[] = []
      if (coding && coding.end > coding.start) {
        if (exon.start < coding.start)
          parts.push({ start: exon.start, end: coding.start, tall: false })
        parts.push({ ...coding, tall: true })
        if (exon.end > coding.end) parts.push({ start: coding.end, end: exon.end, tall: false })
      } else {
        parts.push({ start: exon.start, end: exon.end, tall: false })
      }
      for (const part of parts) {
        const box = scale.boxFor(part.start, part.end)
        const h = part.tall ? EXON_H : UTR_H
        ctx.fillRect(box.x, y - h / 2, box.width, h)
      }
    }

    labelBefore(
      ctx,
      item.gene_name || item.transcript_id,
      left,
      y,
      item.is_atlas_gene,
      ink,
      takenTo[row] ?? -Infinity,
    )
    takenTo[row] = right
  }
}

export interface GeneFrame {
  ctx: CanvasRenderingContext2D
  scale: Scale
  height: number
  top: number
  layout: TrackLayout<GeneSpan>
  ink: GeneInk
}

export function drawGenes({ ctx, scale, height, top, layout, ink }: GeneFrame) {
  ctx.clearRect(0, 0, scale.width, height)
  ctx.lineWidth = 1
  const takenTo: number[] = []

  for (const { item, row } of layout.items) {
    if (item.start > scale.end) break
    if (item.end < scale.start) continue
    const y = rowCentre(row, top)
    const color = ink.colorOf(item.biotype)
    const left = scale.toX(item.start)
    const right = scale.toX(item.end)
    const forward = item.strand !== "-"

    ctx.strokeStyle = color
    ctx.fillStyle = color
    const { tip, back, half } = arrowHead(left, right, forward)
    const stemFrom = forward ? left : back
    const stemTo = forward ? back : right
    if (stemTo > stemFrom) {
      ctx.beginPath()
      ctx.moveTo(stemFrom, y)
      ctx.lineTo(stemTo, y)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(tip, y)
    ctx.lineTo(back, y - half)
    ctx.lineTo(back, y + half)
    ctx.closePath()
    ctx.fill()

    labelBefore(ctx, item.label, left, y, item.is_atlas_gene, ink, takenTo[row] ?? -Infinity)
    takenTo[row] = right
  }
}
