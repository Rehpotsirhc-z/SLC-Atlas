// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Read coverage and features directly from byte-range requests

import type { CoverageTrack } from "@/types/browser"

// Preserve the intervals stored in the bigWig instead of expanding them by base
export interface CoverageArrays {
  starts: Int32Array
  ends: Int32Array
  scores: Float32Array
}

// Store large arrays as non-enumerable properties to keep React profiling inexpensive
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

// Return the local track URL when available, then fall back to its remote source
export function trackUrl(track: CoverageTrack, strand: "plus" | "minus" | null): string | null {
  if (strand === "plus") {
    return track.plus_file ? coverageUrl(track.plus_file) : track.plus_url || null
  }
  if (strand === "minus") {
    return track.minus_file ? coverageUrl(track.minus_file) : track.minus_url || null
  }
  return track.file ? coverageUrl(track.file) : track.url || null
}

// One bigBed feature: where it is, and one tab-separated string of everything else
export interface RawFeature {
  start: number
  end: number
  rest: string
}

export const modelsUrl = () => "/api/browser/models.bb"
export const gwasUrl = (studyId: string) => `/api/browser/gwas/${studyId}.bb`

// Columnar GWAS variants ready for rendering
export interface VariantBlock {
  positions: Int32Array
  // −log10(p); NaN when the p-value underflows
  values: Float32Array
  // Effect sizes; NaN when unavailable
  betas: Float32Array
  names: string
  nameAt: Int32Array
}

// Store typed arrays as non-enumerable properties to keep React profiling inexpensive
function heldBlock(
  positions: Int32Array,
  values: Float32Array,
  betas: Float32Array,
  names: string,
  nameAt: Int32Array,
): VariantBlock {
  return Object.defineProperties({} as VariantBlock, {
    positions: { value: positions },
    values: { value: values },
    betas: { value: betas },
    names: { value: names },
    nameAt: { value: nameAt },
  })
}

export const EMPTY_VARIANTS: VariantBlock = heldBlock(
  new Int32Array(0),
  new Float32Array(0),
  new Float32Array(0),
  "",
  new Int32Array(1),
)

// Return an rsID only when requested
export const variantName = (block: VariantBlock, index: number): string | null => {
  const from = block.nameAt[index]
  const to = block.nameAt[index + 1]
  return to > from ? block.names.slice(from, to) : null
}

interface Reply {
  id: number
  starts?: Int32Array
  ends?: Int32Array
  scores?: Float32Array
  features?: RawFeature[]
  positions?: Int32Array
  values?: Float32Array
  betas?: Float32Array
  names?: string
  nameAt?: Int32Array
  error?: string
}

interface Waiting {
  resolve: (answer: CoverageArrays | RawFeature[] | VariantBlock) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
const waiting = new Map<number, Waiting>()
let nextId = 0

// Read priorities, from visible lanes to speculative index warming
export const READ_VISIBLE = 0
export const READ_OFFSCREEN = 1
export const READ_WARM = 2

// Leave enough browser connections available for each lane's chained range requests to progress
const MAX_READS = 8

interface Queued {
  priority: () => number
  send: () => void
}

const queue: Queued[] = []
let running = 0
let pumping = false

// Let requests from the current render enter the queue before assigning worker slots
function schedulePump(): void {
  if (pumping) return
  pumping = true
  queueMicrotask(() => {
    pumping = false
    pump()
  })
}

// Recheck priorities whenever a slot opens so newly visible lanes move ahead
function pump(): void {
  while (running < MAX_READS && queue.length > 0) {
    let pick = 0
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].priority() < queue[pick].priority()) pick = i
    }
    const [job] = queue.splice(pick, 1)
    running += 1
    job.send()
  }
}

function finished(): void {
  running -= 1
  pump()
}

// Track files whose indexes have already been warmed
const opened = new Set<string>()

const offscreen = () => READ_OFFSCREEN

// Reject pending reads and recreate a worker that fails unexpectedly.
function abandon(dead: Worker, reason: string): void {
  // Ignore late errors from a worker that has already been replaced
  if (worker !== dead) return
  worker = null
  const held = [...waiting.values()]
  waiting.clear()
  dead.terminate()
  for (const { reject } of held) reject(new Error(reason))
}

// Start the reader worker lazily so pages that never open the browser do not load it.
function reader(): Worker {
  if (worker) return worker
  const started = new Worker(new URL("./bbi.worker.ts", import.meta.url), { type: "module" })
  started.onmessage = (event: MessageEvent<Reply>) => {
    const { id, starts, ends, scores, features, positions, values, betas, names, nameAt, error } =
      event.data
    const held = waiting.get(id)
    if (!held) return
    waiting.delete(id)
    if (error !== undefined) {
      held.reject(new Error(error))
      return
    }
    if (positions && values && betas && nameAt) {
      held.resolve(heldBlock(positions, values, betas, names ?? "", nameAt))
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

export interface Read {
  url: string
  chrom: string
  start: number
  end: number
  signal?: AbortSignal
  // Re-evaluated whenever a worker slot opens
  priority?: () => number
  // Summary resolution in bases; omit to read every record
  basesPerSpan?: number
}

function ask<T>(kind: "coverage" | "features" | "variants", read: Read): Promise<T> {
  const { url, chrom, start, end, signal, basesPerSpan } = read
  const priority = read.priority ?? offscreen
  const id = nextId++
  opened.add(url)
  return new Promise<T>((resolve, reject) => {
    // Abort events do not fire retroactively
    if (signal?.aborted) {
      reject(new DOMException("aborted", "AbortError"))
      return
    }
    // Held while the read waits its turn, and dropped once it has been sent
    let job: Queued | null = null
    // Drop stale results without terminating a useful in-flight read
    const drop = () => {
      const at = job ? queue.indexOf(job) : -1
      if (at >= 0) queue.splice(at, 1)
      else if (waiting.delete(id)) finished()
      reject(new DOMException("aborted", "AbortError"))
    }
    signal?.addEventListener("abort", drop, { once: true })
    const settled = () => signal?.removeEventListener("abort", drop)
    job = {
      priority,
      send: () => {
        job = null
        waiting.set(id, {
          resolve: (answer) => {
            settled()
            finished()
            resolve(answer as T)
          },
          reject: (error) => {
            settled()
            finished()
            reject(error)
          },
        })
        reader().postMessage({ id, kind, url, chrom, start, end, basesPerSpan })
      },
    }
    queue.push(job)
    schedulePump()
  })
}

export const readCoverage = (read: Read): Promise<CoverageArrays> => ask("coverage", read)

export const readFeatures = (read: Read): Promise<RawFeature[]> => ask("features", read)

// Read columnar GWAS variants for a genomic interval
export const readVariants = (read: Read): Promise<VariantBlock> => ask("variants", read)

// A one-base read loads reusable headers and indexes without fetching a data block
function warm(kind: "coverage" | "features", url: string, chrom: string): void {
  if (opened.has(url)) return
  ask(kind, { url, chrom, start: 0, end: 1, priority: () => READ_WARM }).catch(() => {})
}

export const warmCoverage = (url: string, chrom: string) => warm("coverage", url, chrom)
export const warmFeatures = (url: string, chrom: string) => warm("features", url, chrom)
