// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Read bigWig coverage and bigBed features outside the main thread. */

import { BigBed, BigWig } from "@gmod/bbi"

interface ReadRequest {
  id: number
  kind: "coverage" | "features"
  url: string
  chrom: string
  start: number
  end: number
  /** Set to read the file's own summaries at this many bases a column instead of every record */
  basesPerSpan?: number
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
  /** A summary record carries the peak of everything it stands for */
  maxScore?: number
}

interface BigWigReader {
  getFeatures(
    chrom: string,
    start: number,
    end: number,
    opts?: { basesPerSpan: number },
  ): Promise<BigWigFeature[]>
  getFeaturesAsArrays?(chrom: string, start: number, end: number): Promise<CoverageArrays>
}

interface BedFeature {
  start: number
  end: number
  rest?: string
}

/** What crosses back for a feature: its span, and one string of everything else */
interface RawFeature {
  start: number
  end: number
  rest: string
}

interface BigBedReader {
  getFeatures(chrom: string, start: number, end: number): Promise<BedFeature[]>
}

const readers = new Map<string, BigWigReader | BigBedReader>()

function open(url: string, kind: ReadRequest["kind"]) {
  let held = readers.get(url)
  if (!held) {
    held = (kind === "features" ? new BigBed({ url }) : new BigWig({ url })) as unknown as
      | BigWigReader
      | BigBedReader
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
    // A summary stands in for a stretch, and what a lane draws of a stretch is its peak
    scores[i] = features[i].maxScore ?? features[i].score ?? 0
  }
  return { starts, ends, scores }
}

// A view wider than the build vouched for is drawn from the file's own summaries: a few hundred
// records where the stored ones run to millions. The array reader has no summary path of its own,
// and at that many records it does not need one
async function readCoverage(request: ReadRequest): Promise<CoverageArrays> {
  const reader = open(request.url, "coverage") as BigWigReader
  const { chrom, start, end, basesPerSpan } = request
  if (basesPerSpan) {
    return toArrays(await reader.getFeatures(chrom, start, end, { basesPerSpan }))
  }
  if (reader.getFeaturesAsArrays) {
    const got = await reader.getFeaturesAsArrays(chrom, start, end)
    // The three come back as views into one buffer the reader owns and may reuse, which can be
    // transferred neither three times nor at all, so they are copied into buffers of their own
    return { starts: got.starts.slice(), ends: got.ends.slice(), scores: got.scores.slice() }
  }
  return toArrays(await reader.getFeatures(chrom, start, end))
}

async function readFeatures(request: ReadRequest): Promise<RawFeature[]> {
  const reader = open(request.url, "features") as BigBedReader
  const got = await reader.getFeatures(request.chrom, request.start, request.end)
  // Send only the fields needed for drawing
  return got.map((feature) => ({
    start: feature.start,
    end: feature.end,
    rest: feature.rest ?? "",
  }))
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
  if (request.kind === "features") {
    readFeatures(request)
      .then((features) => ctx.postMessage({ id: request.id, features }))
      .catch((error: unknown) => ctx.postMessage({ id: request.id, error: String(error) }))
    return
  }
  readCoverage(request)
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
