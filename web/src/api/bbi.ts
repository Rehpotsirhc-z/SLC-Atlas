// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Read coverage and features directly from byte-range requests */

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

/** One bigBed feature: where it is, and one tab-separated string of everything else */
export interface RawFeature {
  start: number
  end: number
  rest: string
}

export const modelsUrl = () => "/api/browser/models.bb"
export const gwasUrl = (studyId: string) => `/api/browser/gwas/${studyId}.bb`

interface Reply {
  id: number
  starts?: Int32Array
  ends?: Int32Array
  scores?: Float32Array
  features?: RawFeature[]
  error?: string
}

interface Waiting {
  resolve: (answer: CoverageArrays | RawFeature[]) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
const waiting = new Map<number, Waiting>()
let nextId = 0

/** Reject pending reads and recreate a worker that fails unexpectedly. */
function abandon(dead: Worker, reason: string): void {
  // Ignore late errors from a worker that has already been replaced
  if (worker !== dead) return
  worker = null
  const held = [...waiting.values()]
  waiting.clear()
  dead.terminate()
  for (const { reject } of held) reject(new Error(reason))
}

/**
 * Start the reader worker lazily so pages that never open the browser do not load it.
 */
function reader(): Worker {
  if (worker) return worker
  const started = new Worker(new URL("./bbi.worker.ts", import.meta.url), { type: "module" })
  started.onmessage = (event: MessageEvent<Reply>) => {
    const { id, starts, ends, scores, features, error } = event.data
    const held = waiting.get(id)
    if (!held) return
    waiting.delete(id)
    if (error !== undefined) {
      held.reject(new Error(error))
      return
    }
    if (features) {
      held.resolve(features)
      return
    }
    if (!starts || !ends || !scores) {
      held.reject(new Error("read failed"))
      return
    }
    held.resolve(heldArrays(starts, ends, scores))
  }
  started.onerror = () => abandon(started, "The reader failed to start")
  started.onmessageerror = () => abandon(started, "The reader sent an unreadable reply")
  worker = started
  return started
}

function ask<T>(
  kind: "coverage" | "features",
  url: string,
  chrom: string,
  start: number,
  end: number,
  signal: AbortSignal | undefined,
): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    // Abort events do not fire retroactively
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"))
      return
    }
    // Drop stale results without terminating a useful in-flight read
    const drop = () => {
      waiting.delete(id)
      reject(new DOMException("aborted", "AbortError"))
    }
    signal?.addEventListener("abort", drop, { once: true })
    const settled = () => signal?.removeEventListener("abort", drop)
    waiting.set(id, {
      resolve: (answer) => {
        settled()
        resolve(answer as T)
      },
      reject: (error) => {
        settled()
        reject(error)
      },
    })
    reader().postMessage({ id, kind, url, chrom, start, end })
  })
}

export const readCoverage = (
  url: string,
  chrom: string,
  start: number,
  end: number,
  signal: AbortSignal | undefined,
): Promise<CoverageArrays> => ask("coverage", url, chrom, start, end, signal)

/** The features of one bigBed over a stretch, whatever kind of thing they turn out to be. */
export const readFeatures = (
  url: string,
  chrom: string,
  start: number,
  end: number,
  signal: AbortSignal | undefined,
): Promise<RawFeature[]> => ask("features", url, chrom, start, end, signal)
