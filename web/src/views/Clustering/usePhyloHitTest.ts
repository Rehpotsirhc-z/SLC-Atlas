// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from "react"
import type { RefObject } from "react"
import { RADIAL, RECT, type LeafLayout, type TreeLayout } from "./phyloLayout"
import type { Transform } from "./usePhyloTransform"

// How far off a leaf's angle/row a pointer may sit and still count as over it
const RADIAL_ANGLE_TOLERANCE = 0.05
const RADIAL_INNER_DEAD_ZONE = 0.08
const RECT_ROW_TOLERANCE = 0.6
const RECT_LEFT_REACH = 3

interface Options {
  layoutData: TreeLayout | null
  isRadial: boolean
  transform: Transform
  rectScale: number
  rowH: number
  svgRef: RefObject<SVGSVGElement | null>
}

export function usePhyloHitTest({
  layoutData,
  isRadial,
  transform,
  rectScale,
  rowH,
  svgRef,
}: Options) {
  return useCallback(
    (clientX: number, clientY: number): LeafLayout | null => {
      if (!layoutData || !svgRef.current) return null
      const rect = svgRef.current.getBoundingClientRect()
      const scale = isRadial ? transform.k : rectScale
      const vx = isRadial
        ? (clientX - rect.left - transform.x) / transform.k
        : (clientX - rect.left) / scale
      const vy = isRadial
        ? (clientY - rect.top - transform.y) / transform.k
        : (clientY - rect.top) / scale

      if (isRadial) {
        const C = RADIAL.maxR + RADIAL.labelMargin
        const radius = Math.hypot(vx - C, vy - C)
        if (radius < RADIAL.maxR * RADIAL_INNER_DEAD_ZONE || radius > C) return null
        const ang = Math.atan2(vy - C, vx - C)
        let best: LeafLayout | null = null
        let bestDiff = Infinity
        for (const l of layoutData.leaves) {
          if (l.angle === null) continue
          const diff = Math.abs(Math.atan2(Math.sin(ang - l.angle), Math.cos(ang - l.angle)))
          if (diff < bestDiff) {
            bestDiff = diff
            best = l
          }
        }
        return best && bestDiff <= RADIAL_ANGLE_TOLERANCE ? best : null
      }

      let best: LeafLayout | null = null
      let bestDiff = Infinity
      for (const l of layoutData.leaves) {
        const d = Math.abs(l.y - vy)
        if (d < bestDiff) {
          bestDiff = d
          best = l
        }
      }
      if (!best) return null
      const outOfRow = bestDiff > rowH * RECT_ROW_TOLERANCE
      const leftOfLabel = vx < best.x - RECT.rowH * RECT_LEFT_REACH
      return outOfRow || leftOfLabel ? null : best
    },
    [layoutData, transform, isRadial, rectScale, rowH, svgRef],
  )
}
