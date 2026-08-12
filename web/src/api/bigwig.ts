// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Read bigWig coverage directly from byte-range requests */

import type { CoverageTrack } from "@/types/browser"

// Preserve the intervals stored in the bigWig instead of expanding them by base
export interface CoverageArrays {
  starts: Int32Array
  ends: Int32Array
  scores: Float32Array
}

/** Store large arrays as non-enumerable properties to keep React profiling inexpensive */
function heldArrays(starts: Int32Array, ends: Int32Array, scores: Float32Array): CoverageArrays {
  return Object.defineProperties({} as CoverageArrays, {
    starts: { value: starts },
    ends: { value: ends },
    scores: { value: scores },
  })
}

export const EMPTY_COVERAGE: CoverageArrays = heldArrays(
  new Int32Array(0),
  new Int32Array(0),
  new Float32Array(0),
)

interface ReadOptions {
  scale?: number
  signal?: AbortSignal
}

interface BigWigFeature {
  start: number
  end: number
  score?: number
}

interface BigWigReader {
  getFeatures(
    chrom: string,
    start: number,
    end: number,
    opts?: ReadOptions,
  ): Promise<BigWigFeature[]>
  getFeaturesAsArrays?(
    chrom: string,
    start: number,
    end: number,
    opts?: ReadOptions,
  ): Promise<CoverageArrays>
}

type BigWigCtor = new (args: { url: string }) => BigWigReader

let loading: Promise<BigWigCtor> | null = null

function parser(): Promise<BigWigCtor> {
  loading ??= import("@gmod/bbi").then((bbi) => bbi.BigWig as unknown as BigWigCtor)
  return loading
}

// Reuse parsed headers and chromosome indexes for the life of the page
const readers = new Map<string, BigWigReader>()

async function open(url: string): Promise<BigWigReader> {
  const held = readers.get(url)
  if (held) return held
  const BigWig = await parser()
  const reader = new BigWig({ url })
  readers.set(url, reader)
  return reader
}

const coverageUrl = (file: string) => `/api/browser/coverage/${file}`

/** Return the local track URL when available, then fall back to its remote source */
export function trackUrl(track: CoverageTrack, strand: "plus" | "minus" | null): string | null {
  if (strand === "plus") {
    return track.plus_file ? coverageUrl(track.plus_file) : track.plus_url || null
  }
  if (strand === "minus") {
    return track.minus_file ? coverageUrl(track.minus_file) : track.minus_url || null
  }
  return track.file ? coverageUrl(track.file) : track.url || null
}

function toArrays(features: BigWigFeature[]): CoverageArrays {
  const starts = new Int32Array(features.length)
  const ends = new Int32Array(features.length)
  const scores = new Float32Array(features.length)
  for (let i = 0; i < features.length; i++) {
    starts[i] = features[i].start
    ends[i] = features[i].end
    scores[i] = features[i].score ?? 0
  }
  return heldArrays(starts, ends, scores)
}

export async function readCoverage(
  url: string,
  chrom: string,
  start: number,
  end: number,
  // Request summarized data only when the visible span is too wide for full resolution
  scale: number | undefined,
  signal: AbortSignal | undefined,
): Promise<CoverageArrays> {
  const reader = await open(url)
  const opts: ReadOptions = { signal }
  if (scale !== undefined) opts.scale = scale
  if (reader.getFeaturesAsArrays) {
    const got = await reader.getFeaturesAsArrays(chrom, start, end, opts)
    return heldArrays(got.starts, got.ends, got.scores)
  }
  return toArrays(await reader.getFeatures(chrom, start, end, opts))
}
