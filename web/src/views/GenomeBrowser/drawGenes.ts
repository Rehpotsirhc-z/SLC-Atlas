// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Draw transcript or gene models on a canvas */

import type { TranscriptModel } from "@/types/browser"
import {
  ARROW_H,
  CANVAS_LABEL_PX,
  CHEVRON_SPACING,
  EXON_H,
  GENE_ROW_H,
  LABEL_GAP_PX,
  LABEL_MIN_PX,
  MIN_ARROW_PX,
  UTR_H,
} from "./constants"
import type { GeneSpan, TrackLayout } from "./geneLayout"
import type { Scale } from "./scale"

export interface GeneInk {
  colorOf: (biotype: string | null) => string
  label: string
  highlight: string
  font: string
  /** Widths already measured, since a name keeps its width for as long as the face does */
  widths: Map<string, number>
}

const rowCentre = (row: number, top: number) => top + row * GENE_ROW_H + GENE_ROW_H / 2

/** One path for a whole intron's worth of arrows, a stroke apiece being most of what they cost. */
function chevrons(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  y: number,
  forward: boolean,
) {
  const reach = 3
  const first = Math.ceil(from / CHEVRON_SPACING) * CHEVRON_SPACING
  let drawn = false
  ctx.beginPath()
  for (let x = first; x < to; x += CHEVRON_SPACING) {
    if (x - reach < from) continue
    ctx.moveTo(x - (forward ? reach : -reach), y - reach)
    ctx.lineTo(x + (forward ? reach : -reach), y)
    ctx.lineTo(x - (forward ? reach : -reach), y + reach)
    drawn = true
  }
  if (drawn) ctx.stroke()
}

/**
 * Draw a name to the left of a model, but only into space nothing else on that row has
 * taken. A row can hold many models, and labelling every one of them writes each name over
 * the model before it, which is worse than leaving some of them unnamed.
 */
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
  const face = `${bold ? 600 : 400} ${CANVAS_LABEL_PX}px ${ink.font}`
  // Measuring is the dearest call in this loop and a name is measured on every frame of a drag,
  // so the width is kept and the face is only set when there is something to draw
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
  // How far along each row something has already been drawn, so a name is only written into
  // space that is still free. Models arrive left to right, which is what makes this enough
  const takenTo: number[] = []

  for (const { item, row } of layout.items) {
    // Packed in start order, so nothing past the right edge can be followed by something inside
    if (item.start > scale.end) break
    if (item.end < scale.start) continue
    const y = rowCentre(row, top)
    const color = ink.colorOf(item.biotype)
    const left = scale.toX(item.start)
    const right = scale.toX(item.end)

    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(left, Math.round(y) + 0.5)
    ctx.lineTo(right, Math.round(y) + 0.5)
    ctx.stroke()
    chevrons(ctx, Math.max(left, 0), Math.min(right, scale.width), y, item.strand !== "-")

    ctx.fillStyle = color
    for (const exon of item.exons) {
      // An exon is drawn twice where it is part coding and part not, so the reader sees
      // where translation actually starts rather than only where the exon does
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
  ctx.lineWidth = 1.5
  const takenTo: number[] = []

  for (const { item, row } of layout.items) {
    if (item.start > scale.end) break
    if (item.end < scale.start) continue
    const y = rowCentre(row, top)
    const color = item.is_atlas_gene ? ink.highlight : ink.colorOf(item.biotype)
    const left = scale.toX(item.start)
    const right = scale.toX(item.end)
    const forward = item.strand !== "-"

    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(left, Math.round(y) + 0.5)
    ctx.lineTo(right, Math.round(y) + 0.5)
    ctx.stroke()

    // The head sits at the end the gene reads towards, which is the whole point of this mode,
    // and is never longer than the gene it points along: a chromosome of genes each narrower
    // than one head would otherwise draw as nothing but heads
    const head = Math.min(ARROW_H, right - left)
    if (head >= MIN_ARROW_PX) {
      const tip = forward ? right : left
      const back = forward ? tip - head : tip + head
      ctx.beginPath()
      ctx.moveTo(tip, y)
      ctx.lineTo(back, y - head / 2)
      ctx.lineTo(back, y + head / 2)
      ctx.closePath()
      ctx.fill()
    }

    labelBefore(ctx, item.label, left, y, item.is_atlas_gene, ink, takenTo[row] ?? -Infinity)
    takenTo[row] = right
  }
}
