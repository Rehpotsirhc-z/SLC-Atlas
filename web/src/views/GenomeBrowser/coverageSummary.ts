// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * A lane's records read at the stride the zoom can show.
 *
 * A slice holds a run of records per window, and a view wide enough to hold several windows
 * holds more records than it has pixels, which a lane would otherwise walk end to end on every
 * frame of a drag. Records are merged in powers of two and the tallest of each group is kept,
 * so the peak a column is drawn at is the one the full records would have given it.
 *
 * A group is closed wherever the records stop being contiguous, so it covers exactly what its
 * members covered. That is the whole discipline here: merging across a gap would let a lane
 * report signal over a stretch its track says nothing about, which is the one mistake this
 * view must not make, and it is why the file's own reduced views are not used.
 *
 * Levels are held against the records they were built from, so they are built once per read
 * and let go with it.
 */

import type { CoverageArrays } from "@/api/bbi"

/** Walk the records in groups of `stride`, breaking wherever the track leaves a gap. */
function eachGroup(
  data: CoverageArrays,
  stride: number,
  visit: (from: number, to: number) => void,
) {
  const { starts, ends } = data
  const count = starts.length
  let from = 0
  for (let i = 1; i <= count; i++) {
    if (i === count || starts[i] !== ends[i - 1] || i - from === stride) {
      visit(from, i)
      from = i
    }
  }
}

function decimate(data: CoverageArrays, stride: number): CoverageArrays {
  let groups = 0
  eachGroup(data, stride, () => {
    groups += 1
  })

  const starts = new Int32Array(groups)
  const ends = new Int32Array(groups)
  const scores = new Float32Array(groups)
  let at = 0
  eachGroup(data, stride, (from, to) => {
    let peak = data.scores[from]
    for (let i = from + 1; i < to; i++) {
      if (data.scores[i] > peak) peak = data.scores[i]
    }
    starts[at] = data.starts[from]
    ends[at] = data.ends[to - 1]
    scores[at] = peak
    at += 1
  })
  return { starts, ends, scores }
}

const levels = new WeakMap<CoverageArrays, Map<number, CoverageArrays>>()

export function coverageAtStride(data: CoverageArrays, stride: number): CoverageArrays {
  if (stride <= 1 || data.starts.length === 0) return data
  let held = levels.get(data)
  if (!held) {
    held = new Map()
    levels.set(data, held)
  }
  const found = held.get(stride)
  if (found) return found
  const made = decimate(data, stride)
  held.set(stride, made)
  return made
}
