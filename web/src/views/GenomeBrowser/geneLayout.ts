// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Assign stable rows to gene and transcript models */

import type { TranscriptModel } from "@/types/browser"

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
  rows: number
  items: Placed<T>[]
  hidden: number
}

interface Spanning {
  start: number
  end: number
}

/**
 * Greedy first-fit: the standard packing, and deterministic, unlike scattering rows at
 * random and rejecting collisions.
 */
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
  return { rows: lastEnd.length, items: placed, hidden }
}

export function layoutTranscripts(
  transcripts: TranscriptModel[],
  gap: number,
  maxRows: number,
): TrackLayout<TranscriptModel> {
  return pack(transcripts, gap, maxRows)
}

/** One entry per gene, spanning every transcript it has, for the compact mode. */
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

/** What sits under the cursor, given a row and a base. */
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
