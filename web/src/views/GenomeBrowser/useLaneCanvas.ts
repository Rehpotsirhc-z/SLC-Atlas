// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Paint a browser lane on a high-density canvas */

import { useEffect, useRef, useState } from "react"
import { scaleFor, type Scale, type Viewport } from "./scale"
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
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dpr = useDevicePixelRatio()
  // Held in a ref so a changed painter repaints without tearing the canvas down
  const latest = useRef(paint)
  latest.current = paint

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0 || height <= 0) return
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    return subscribe((view) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      latest.current(ctx, scaleFor(view, width))
    })
  }, [subscribe, width, height, dpr])

  // New data, new colours or a theme flip have to land without waiting for the next gesture,
  // and at the position the user is looking at rather than the one React last committed
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || width <= 0 || height <= 0) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paint(ctx, scaleFor(liveView(), width))
  }, [paint, liveView, width, height, dpr])

  return canvasRef
}
