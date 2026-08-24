// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import type { ElementSize } from "@/utils/useElementSize"
import type { TreeLayout } from "./phyloLayout"

export interface Transform {
  k: number
  x: number
  y: number
}

const ZOOM_STEP = 1.15
const MIN_ZOOM_FACTOR = 0.5
const MAX_ZOOM_FACTOR = 80
export const FIT_MARGIN = 0.92
const DRAG_SLOP_PX = 3

// Completed gesture type, used to decide whether pointer-up should trigger a hover test
export type GesturePhase = "pinch" | "pan" | "idle"

interface Options {
  isRadial: boolean
  layoutData: TreeLayout | null
  size: ElementSize
  svgRef: RefObject<SVGSVGElement | null>
  containerRef: RefObject<HTMLDivElement | null>
}

export function usePhyloTransform({ isRadial, layoutData, size, svgRef, containerRef }: Options) {
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 })
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const fitScale = useRef(1)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{
    dist: number
    cx: number
    cy: number
    k: number
    tx: number
    ty: number
  } | null>(null)

  const clampZoom = (k: number) =>
    Math.min(fitScale.current * MAX_ZOOM_FACTOR, Math.max(fitScale.current * MIN_ZOOM_FACTOR, k))

  const fit = useCallback(() => {
    if (!isRadial || !layoutData || size.w === 0 || size.h === 0) return
    const s = Math.min(size.w / layoutData.width, size.h / layoutData.height) * FIT_MARGIN
    fitScale.current = s
    setTransform({
      k: s,
      x: (size.w - layoutData.width * s) / 2,
      y: (size.h - layoutData.height * s) / 2,
    })
  }, [isRadial, layoutData, size])

  useEffect(() => {
    fit()
  }, [fit])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !isRadial) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      setTransform((t) => {
        const k = clampZoom(t.k * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP))
        const vx = (sx - t.x) / t.k
        const vy = (sy - t.y) / t.k
        return { k, x: sx - vx * k, y: sy - vy * k }
      })
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [isRadial, svgRef])

  const reset = useCallback(() => {
    if (isRadial) fit()
    else containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [isRadial, fit, containerRef])

  const beginGesture = useCallback(
    (e: React.PointerEvent) => {
      if (isRadial) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        svgRef.current?.setPointerCapture(e.pointerId)
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()]
          const rect = svgRef.current!.getBoundingClientRect()
          pinch.current = {
            dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
            cx: (a.x + b.x) / 2 - rect.left,
            cy: (a.y + b.y) / 2 - rect.top,
            k: transform.k,
            tx: transform.x,
            ty: transform.y,
          }
          drag.current.active = false
          drag.current.moved = true // a pinch should never trigger a click-select
          return
        }
      }
      drag.current = {
        active: isRadial,
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
        ox: transform.x,
        oy: transform.y,
      }
    },
    [isRadial, transform, svgRef],
  )

  const moveGesture = useCallback(
    (e: React.PointerEvent): GesturePhase => {
      if (pinch.current && pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()]
          const rect = svgRef.current!.getBoundingClientRect()
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
          const mx = (a.x + b.x) / 2 - rect.left
          const my = (a.y + b.y) / 2 - rect.top
          const p = pinch.current
          const k = clampZoom(p.k * (dist / p.dist))
          setTransform({ k, x: mx - ((p.cx - p.tx) / p.k) * k, y: my - ((p.cy - p.ty) / p.k) * k })
        }
        return "pinch"
      }
      if (drag.current.active) {
        const dx = e.clientX - drag.current.sx
        const dy = e.clientY - drag.current.sy
        if (Math.abs(dx) > DRAG_SLOP_PX || Math.abs(dy) > DRAG_SLOP_PX) drag.current.moved = true
        setTransform((t) => ({ ...t, x: drag.current.ox + dx, y: drag.current.oy + dy }))
        return "pan"
      }
      if (
        e.buttons > 0 &&
        (Math.abs(e.clientX - drag.current.sx) > DRAG_SLOP_PX ||
          Math.abs(e.clientY - drag.current.sy) > DRAG_SLOP_PX)
      ) {
        drag.current.moved = true
      }
      return "idle"
    },
    [svgRef],
  )

  // Returns true when the pointer-up should be treated as a click-select
  const endGesture = useCallback(
    (e: React.PointerEvent): boolean => {
      if (isRadial) {
        pointers.current.delete(e.pointerId)
        svgRef.current?.releasePointerCapture(e.pointerId)
        if (pointers.current.size < 2) pinch.current = null
        if (pointers.current.size === 1) {
          // One finger remains after a pinch, so resume panning
          const [rem] = [...pointers.current.values()]
          drag.current = {
            active: true,
            moved: true,
            sx: rem.x,
            sy: rem.y,
            ox: transform.x,
            oy: transform.y,
          }
          return false
        }
      }
      const wasDrag = drag.current.moved
      drag.current.active = false
      return !wasDrag
    },
    [isRadial, transform, svgRef],
  )

  const cancelGesture = useCallback(() => {
    drag.current.active = false
  }, [])

  return {
    transform,
    setTransform,
    dragging: drag.current.active,
    fit,
    reset,
    beginGesture,
    moveGesture,
    endGesture,
    cancelGesture,
  }
}
