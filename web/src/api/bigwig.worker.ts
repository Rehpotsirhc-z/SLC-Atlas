// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Reads bigWig coverage off the main thread.
 *
 * A read is a range request, a WASM inflate and a walk into typed arrays, and a view holds two
 * dozen tracks that all answer at once, so doing it here is what keeps a gene switch or a zoom
 * out from standing on the frame loop. The arrays go back as transferables, so handing them over
 * copies nothing.
 *
 * The reader map lives here rather than on the other side: a reader holds the file's header and
 * chromosome index, which is the part worth keeping between reads.
 */

import { BigWig } from "@gmod/bbi"

interface ReadRequest {
  id: number
  url: string
  chrom: string
  start: number
  end: number
}

interface CoverageArrays {
  starts: Int32Array
  ends: Int32Array
  scores: Float32Array
}

interface BigWigFeature {
  start: number
  end: number
  score?: number
}

interface BigWigReader {
  getFeatures(chrom: string, start: number, end: number): Promise<BigWigFeature[]>
  getFeaturesAsArrays?(chrom: string, start: number, end: number): Promise<CoverageArrays>
}

const readers = new Map<string, BigWigReader>()

function open(url: string): BigWigReader {
  let held = readers.get(url)
  if (!held) {
    held = new BigWig({ url }) as unknown as BigWigReader
    readers.set(url, held)
  }
  return held
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
  return { starts, ends, scores }
}

// Records are always read at their stored resolution, never through the file's reduced views,
// which report signal across stretches a track holds none of
async function read(request: ReadRequest): Promise<CoverageArrays> {
  const reader = open(request.url)
  const { chrom, start, end } = request
  if (reader.getFeaturesAsArrays) {
    const got = await reader.getFeaturesAsArrays(chrom, start, end)
    // The three come back as views into one buffer the reader owns and may reuse, which can be
    // transferred neither three times nor at all, so they are copied into buffers of their own
    return { starts: got.starts.slice(), ends: got.ends.slice(), scores: got.scores.slice() }
  }
  return toArrays(await reader.getFeatures(chrom, start, end))
}

// The project compiles against the DOM lib, where `self` is a Window and postMessage takes an
// origin. Naming the worker's own shape here is narrower than pulling the webworker lib in
// alongside the DOM one, which redeclares much of it
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<ReadRequest>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}

ctx.onmessage = (event) => {
  const request = event.data
  read(request)
    .then((arrays) => {
      // A read that answered with nothing still answered, and the other side tells the two apart
      ctx.postMessage({ id: request.id, ...arrays }, [
        arrays.starts.buffer,
        arrays.ends.buffer,
        arrays.scores.buffer,
      ])
    })
    .catch((error: unknown) => {
      ctx.postMessage({ id: request.id, error: String(error) })
    })
}
