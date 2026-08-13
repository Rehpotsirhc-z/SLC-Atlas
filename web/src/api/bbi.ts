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

/** Where a read sits in the queue: what the eye is on, then the rest of the stack, then warming */
export const READ_VISIBLE = 0
export const READ_OFFSCREEN = 1
export const READ_WARM = 2

/**
 * How many reads may be in flight at once. A read is a chain of range requests that can only go one
 * after another, the header naming where the index is and the index naming where the data is, and
 * an origin answers six connections at a time, so two dozen lanes asking together leaves a lane's
 * second request queued behind everyone else's first. Held to a few, the lanes on screen finish in
 * the time the whole stack used to take, and the rest follow while nobody is looking at them.
 */
const MAX_READS = 8

/** A read that has not been sent yet, and how much it is wanted */
interface Queued {
  priority: () => number
  send: () => void
}

const queue: Queued[] = []
let running = 0
let pumping = false

/**
 * A block is asked for by every lane at once, so the queue is left to fill before any of it is sent:
 * sending on arrival would spend the free slots on whichever lane React reached first, which is the
 * top of the stack rather than the part of it being looked at.
 */
function schedulePump(): void {
  if (pumping) return
  pumping = true
  queueMicrotask(() => {
    pumping = false
    pump()
  })
}

/**
 * Send what the free slots can take, most wanted first. Priority is asked for at the moment a slot
 * frees rather than when the read was made, so a lane scrolled into view is served as one.
 */
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

/** Files whose header and index have been asked for, so warming never repeats a read */
const opened = new Set<string>()

const offscreen = () => READ_OFFSCREEN

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

export interface Read {
  url: string
  chrom: string
  start: number
  end: number
  signal?: AbortSignal
  /** How badly this read is wanted, asked for again each time a slot frees */
  priority?: () => number
  /** Set to read the file's own summaries at this many bases a column instead of every record */
  basesPerSpan?: number
}

function ask<T>(kind: "coverage" | "features", read: Read): Promise<T> {
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

/** The features of one bigBed over a stretch, whatever kind of thing they turn out to be. */
export const readFeatures = (read: Read): Promise<RawFeature[]> => ask("features", read)

/**
 * Open a file before a locus is asked of it. Four of the five range requests a first read makes are
 * spent finding out where the data is rather than reading any, and that walk is the same wherever
 * the view lands, so it is worth making while the view is still deciding. One base at the start of a
 * chromosome pulls the header, the chromosome list and the root of the index, and no data block.
 */
function warm(kind: "coverage" | "features", url: string, chrom: string): void {
  if (opened.has(url)) return
  ask(kind, { url, chrom, start: 0, end: 1, priority: () => READ_WARM }).catch(() => {})
}

export const warmCoverage = (url: string, chrom: string) => warm("coverage", url, chrom)
export const warmFeatures = (url: string, chrom: string) => warm("features", url, chrom)
