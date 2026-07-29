// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { Transcript } from "@/types/gene"
import type { SortDir } from "@/types/table"

export type TranscriptSortKey = "id" | "name" | "type" | "start" | "length"

export function sortTranscripts(transcripts: Transcript[], key: TranscriptSortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1
  return [...transcripts].sort((a, b) => {
    const av = a[key]
    const bv = b[key]
    if (typeof av === "number" && typeof bv === "number") return sign * (av - bv)
    return sign * String(av ?? "").localeCompare(String(bv ?? ""))
  })
}

/** Biotype counts, most common first */
export function buildTypeCounts(transcripts: Transcript[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const t of transcripts) counts.set(t.type, (counts.get(t.type) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

export interface TranscriptStats {
  total: number
  span: number
  minLength: number
  maxLength: number
  longestId: string
  longestName: string
}

export function buildTranscriptStats(transcripts: Transcript[]): TranscriptStats | null {
  if (!transcripts.length) return null
  const lengths = transcripts.map((t) => t.length)
  const longest = transcripts.reduce((a, b) => (a.length >= b.length ? a : b))
  return {
    total: transcripts.length,
    span: Math.max(...transcripts.map((t) => t.end)) - Math.min(...transcripts.map((t) => t.start)),
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    longestId: longest.id,
    longestName: longest.name,
  }
}
