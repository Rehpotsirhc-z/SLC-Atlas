// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { Transcript } from "@/types/gene"

export const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1]

export const TEXT_COLOR = { dark: "#9ca0a4", light: "#5B6268" }
export const GRID_COLOR = { dark: "#3f444a", light: "#c6c7c7" }

export interface TranscriptScale {
  minStart: number
  maxEnd: number
  span: number
  // 0 at the leftmost transcript start, 1 at the rightmost end
  fraction: (pos: number) => number
}

export function buildTranscriptScale(transcripts: Transcript[]): TranscriptScale {
  const minStart = Math.min(...transcripts.map((t) => t.start))
  const maxEnd = Math.max(...transcripts.map((t) => t.end))
  const span = maxEnd - minStart || 1
  return { minStart, maxEnd, span, fraction: (pos) => (pos - minStart) / span }
}

export function formatMb(pos: number): string {
  return `${(pos / 1_000_000).toFixed(2)} Mb`
}
