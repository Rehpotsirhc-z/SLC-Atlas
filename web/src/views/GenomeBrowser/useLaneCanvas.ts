// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Paint a browser lane on a high-density canvas */

import { useEffect, useRef, useState } from "react"
import { frameScale, type Scale, type Viewport } from "./scale"
import type { LaneWatch } from "./useLaneVisibility"
import type { Painter } from "./useBrowserView"

export type LanePaint = (ctx: CanvasRenderingContext2D, scale: Scale) => void

/**
 * The display's pixel ratio, watched rather than read once. Dragging a window to a screen of a
 * different density changes it, and a backing store sized for the old one would then be
 * painted through the new one's transform.
 */
function useDevicePixelRatio(): number {
  const [ratio, setRatio] = useState(() => window.devicePixelRatio || 1)
  useEffect(() => {
    const media = window.matchMedia(`(resolution: ${ratio}dppx)`)
    const onChange = () => setRatio(window.devicePixelRatio || 1)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [ratio])
  return ratio
}

export function useLaneCanvas(
  subscribe: (paint: Painter) => () => void,
  liveView: () => Viewport,
  width: number,
  height: number,
  paint: LanePaint,
  watch?: LaneWatch,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dpr = useDevicePixelRatio()
  // Held in a ref so a changed painter repaints without tearing the canvas down
  const latest = useRef(paint)
  latest.current = paint
  // Starts on, so a lane nobody watches is never culled and every lane paints once at mount,
  // the observer's first callback arriving a frame later
  const onScreen = useRef(true)
  const missed = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = (view: Viewport) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      latest.current(ctx, frameScale(view, width))
    }
    const stop = subscribe((view) => {
      if (!onScreen.current) {
        missed.current = true
        return
      }
      draw(view)
    })
    // A lane off the frame is drawn once, where the view got to while it was away
    const unwatch = watch?.(canvas, (visible) => {
      onScreen.current = visible
      if (!visible || !missed.current) return
      missed.current = false
      draw(liveView())
    })
    return () => {
      stop()
      unwatch?.()
    }
  }, [subscribe, watch, liveView, width, height, dpr])

  // New data, new colors or a theme flip have to land without waiting for the next gesture,
  // and at the position the user is looking at rather than the one React last committed
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || width <= 0 || height <= 0) return
    if (!onScreen.current) {
      missed.current = true
      return
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, frameScale(liveView(), width))
  }, [paint, liveView, width, height, dpr])

  return canvasRef
}
