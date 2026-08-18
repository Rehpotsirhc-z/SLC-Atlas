// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Cache power-of-two summary levels so dense coverage remains cheap to draw while panning
// Groups stop at gaps to avoid showing signal where the source track has no records

import type { CoverageArrays } from "@/api/bbi"

// Walk the records in groups of `stride`, breaking wherever the track leaves a gap.
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
