// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Read bigWig coverage and bigBed features outside the main thread.

import { BigBed, BigWig } from "@gmod/bbi"

interface ReadRequest {
  id: number
  kind: "coverage" | "features" | "variants"
  url: string
  chrom: string
  start: number
  end: number
  // Summary resolution in bases; omit to read every record
  basesPerSpan?: number
}

// Columnar GWAS variants transferred to the main thread
interface VariantArrays {
  positions: Int32Array
  // −log10(p); NaN when the p-value underflows
  values: Float32Array
  // Effect sizes; NaN when unavailable
  betas: Float32Array
  // Concatenated rsIDs
  names: string
  // Offsets into names, including the final bound
  nameAt: Int32Array
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
  // Peak score represented by a summary record
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

// What crosses back for a feature: its span, and one string of everything else
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

// Read GWAS variants into transferable columnar arrays
// Fields follow VARIANT_FIELDS: snp_id, p_value, neg_log10_p, beta
// The p-value is omitted because neg_log10_p preserves values below the Float32 range
async function readVariants(request: ReadRequest): Promise<VariantArrays> {
  const reader = open(request.url, "features") as BigBedReader
  const got = await reader.getFeatures(request.chrom, request.start, request.end)
  const count = got.length
  const positions = new Int32Array(count)
  const values = new Float32Array(count)
  const betas = new Float32Array(count)
  const nameAt = new Int32Array(count + 1)
  const names: string[] = new Array(count)
  let at = 0
  for (let i = 0; i < count; i++) {
    const feature = got[i]
    const rest = feature.rest ?? ""
    // Parse in place to avoid temporary strings for every variant
    const a = rest.indexOf("\t")
    const b = rest.indexOf("\t", a + 1)
    const c = rest.indexOf("\t", b + 1)
    const snp = a < 0 ? "" : rest.slice(0, a)
    const name = snp === "." ? "" : snp
    positions[i] = feature.start
    // Missing values represent p-values that underflowed to zero
    const value = b < 0 ? "" : rest.slice(b + 1, c < 0 ? rest.length : c)
    values[i] = value === "" ? NaN : +value
    const beta = c < 0 ? "" : rest.slice(c + 1)
    betas[i] = beta === "" ? NaN : +beta
    names[i] = name
    nameAt[i] = at
    at += name.length
  }
  nameAt[count] = at
  return { positions, values, betas, names: names.join(""), nameAt }
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
  if (request.kind === "variants") {
    readVariants(request)
      .then((block) => {
        ctx.postMessage({ id: request.id, ...block }, [
          block.positions.buffer,
          block.values.buffer,
          block.betas.buffer,
          block.nameAt.buffer,
        ])
      })
      .catch((error: unknown) => ctx.postMessage({ id: request.id, error: String(error) }))
    return
  }
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
