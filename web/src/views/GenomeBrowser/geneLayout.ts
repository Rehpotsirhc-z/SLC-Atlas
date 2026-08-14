// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Arrange gene and transcript models into rows

import type { TranscriptModel } from "@/types/browser"
import { MODEL_GAP_PX } from "./constants"
import type { Viewport } from "./scale"

// Base the gap on the visible scale rather than the larger loaded block
// Round the scale to powers of two so small zoom changes keep the same layout
export function rowGap(view: Viewport, width: number): number {
  const perPixel = (view.end - view.start) / Math.max(width, 1)
  return 2 ** Math.floor(Math.log2(Math.max(perPixel, 1))) * MODEL_GAP_PX
}

export interface GeneSpan {
  gene_id: string
  label: string
  biotype: string | null
  strand: string
  start: number
  end: number
  is_atlas_gene: boolean
  transcripts: number
}

export interface Placed<T> {
  item: T
  row: number
}

export interface TrackLayout<T> {
  items: Placed<T>[]
  hidden: number
}

export interface Spanning {
  start: number
  end: number
}

// Place each model in the first available row
function pack<T extends Spanning>(items: T[], gap: number, maxRows: number): TrackLayout<T> {
  const ordered = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const lastEnd: number[] = []
  const placed: Placed<T>[] = []
  let hidden = 0

  for (const item of ordered) {
    let row = lastEnd.findIndex((end) => item.start >= end + gap)
    if (row === -1) row = lastEnd.length
    if (row >= maxRows) {
      hidden += 1
      continue
    }
    lastEnd[row] = item.end
    placed.push({ item, row })
  }
  return { items: placed, hidden }
}

export function layoutTranscripts(
  transcripts: TranscriptModel[],
  gap: number,
  maxRows: number,
): TrackLayout<TranscriptModel> {
  return pack(transcripts, gap, maxRows)
}

// Combine each gene's transcripts into one span for compact mode
export function collapseToGenes(transcripts: TranscriptModel[]): GeneSpan[] {
  const byGene = new Map<string, GeneSpan>()
  for (const model of transcripts) {
    const key = model.model_gene_id ?? model.transcript_id
    const held = byGene.get(key)
    if (!held) {
      byGene.set(key, {
        gene_id: key,
        label: model.gene_name || key,
        biotype: model.biotype,
        strand: model.strand,
        start: model.start,
        end: model.end,
        is_atlas_gene: model.is_atlas_gene,
        transcripts: 1,
      })
      continue
    }
    held.start = Math.min(held.start, model.start)
    held.end = Math.max(held.end, model.end)
    held.transcripts += 1
    held.is_atlas_gene ||= model.is_atlas_gene
  }
  return [...byGene.values()]
}

export function layoutGenes(
  spans: GeneSpan[],
  gap: number,
  maxRows: number,
): TrackLayout<GeneSpan> {
  return pack(spans, gap, maxRows)
}

// Count rows occupied by models that overlap the visible region
export function rowsInView(layout: TrackLayout<Spanning>, view: Viewport): number {
  let deepest = -1
  for (const { item, row } of layout.items) {
    if (item.start > view.end) break
    if (item.end < view.start) continue
    if (row > deepest) deepest = row
  }
  return deepest + 1
}

// Find the item under the cursor in the given row
export function itemAt<T extends Spanning>(
  layout: TrackLayout<T>,
  row: number,
  base: number,
  slack: number,
): T | null {
  for (const placed of layout.items) {
    if (placed.row !== row) continue
    if (base >= placed.item.start - slack && base <= placed.item.end + slack) return placed.item
  }
  return null
}
