// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Handle panning, zooming, and range selection */

import { useCallback, useEffect, useRef, type RefObject } from "react"
import {
  DRAG_SLOP_PX,
  RANGE_SELECT_MIN_PX,
  WHEEL_ZOOM_MAX,
  WHEEL_ZOOM_PER_PX,
  ZOOM_STEP,
} from "./constants"
import type { BrowserView } from "./useBrowserView"
import type { Viewport } from "./scale"

interface Options {
  view: BrowserView
  plotRef: RefObject<HTMLElement | null>
  selectionRef: RefObject<HTMLDivElement | null>
  width: number
  /** Where the plot starts, since the labels down the left are not part of it */
  gutter: number
  enabled: boolean
}

interface Drag {
  pointerId: number
  originX: number
  from: Viewport
  ranging: boolean
  moved: boolean
  /** Measured once: asking the layout where the plot is, every move, is asking it to settle */
  left: number
}

// A wheel that reports in lines or in pages says so, and its numbers mean something else
const DELTA_TO_PX = [1, 16, 400]

export function usePanGestures({ view, plotRef, selectionRef, width, gutter, enabled }: Options) {
  const drag = useRef<Drag | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  const baseAt = useCallback(
    (clientX: number) => {
      const box = plotRef.current?.getBoundingClientRect()
      const current = viewRef.current.liveView()
      if (!box || width <= 0) return (current.start + current.end) / 2
      const share = (clientX - box.left - gutter) / width
      return current.start + share * (current.end - current.start)
    },
    [plotRef, gutter, width],
  )

  const showSelection = useCallback(
    (from: number | null, to?: number) => {
      const el = selectionRef.current
      if (!el) return
      if (from === null || to === undefined) {
        el.style.display = "none"
        return
      }
      el.style.display = "block"
      el.style.left = `${gutter + Math.min(from, to)}px`
      el.style.width = `${Math.abs(to - from)}px`
    },
    [selectionRef, gutter],
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return
      const box = event.currentTarget.getBoundingClientRect()
      // Dragging the labels down the left is not a pan; that column is for reading
      if (event.clientX - box.left < gutter) return
      drag.current = {
        pointerId: event.pointerId,
        originX: event.clientX - box.left - gutter,
        from: viewRef.current.liveView(),
        ranging: event.shiftKey,
        moved: false,
        left: box.left,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [enabled, gutter],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const active = drag.current
      if (!active || active.pointerId !== event.pointerId) return
      const x = event.clientX - active.left - gutter
      const dx = x - active.originX
      if (!active.moved && Math.abs(dx) < DRAG_SLOP_PX) return
      active.moved = true

      if (active.ranging) {
        showSelection(active.originX, x)
        return
      }
      const perPixel = (active.from.end - active.from.start) / Math.max(width, 1)
      const shift = -dx * perPixel
      viewRef.current.apply({ start: active.from.start + shift, end: active.from.end + shift })
    },
    [showSelection, width, gutter],
  )

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const active = drag.current
      if (!active || active.pointerId !== event.pointerId) return
      drag.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      if (!active.moved) return

      if (active.ranging) {
        showSelection(null)
        const x = event.clientX - active.left - gutter
        if (Math.abs(x - active.originX) < RANGE_SELECT_MIN_PX) return
        const span = active.from.end - active.from.start
        const perPixel = span / Math.max(width, 1)
        const a = active.from.start + Math.min(active.originX, x) * perPixel
        const b = active.from.start + Math.max(active.originX, x) * perPixel
        viewRef.current.goTo({ start: a, end: b })
        return
      }
      viewRef.current.commit()
    },
    [showSelection, width, gutter],
  )

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!enabled) return
      viewRef.current.zoomBy(ZOOM_STEP, baseAt(event.clientX))
    },
    [baseAt, enabled],
  )

  // Wheel has to be bound by hand: React listens passively, and a passive listener may not
  // call preventDefault, which is how the page is stopped from zooming with the modifier held
  useEffect(() => {
    const el = plotRef.current
    if (!el || !enabled) return
    // Zoom follows the wheel by how far it was turned rather than by the notch, so a pinch on a
    // trackpad, which sends a stream of small deltas, travels as smoothly as it feels
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const px = event.deltaY * (DELTA_TO_PX[event.deltaMode] ?? 1)
      const factor = Math.min(
        Math.max(2 ** (-px * WHEEL_ZOOM_PER_PX), 1 / WHEEL_ZOOM_MAX),
        WHEEL_ZOOM_MAX,
      )
      viewRef.current.zoomBy(factor, baseAt(event.clientX))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [plotRef, baseAt, enabled])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!enabled) return
      const current = viewRef.current
      // Read from where the view is rather than from where it was published, since a held key
      // moves it several times before it says so
      const live = current.liveView()
      const step = (live.end - live.start) / 4
      const keys: Record<string, () => void> = {
        ArrowLeft: () => current.panBy(-step),
        ArrowRight: () => current.panBy(step),
        "+": () => current.zoomBy(ZOOM_STEP),
        "=": () => current.zoomBy(ZOOM_STEP),
        "-": () => current.zoomBy(1 / ZOOM_STEP),
        _: () => current.zoomBy(1 / ZOOM_STEP),
        "0": () => current.reset(),
      }
      const act = keys[event.key]
      if (!act) return
      event.preventDefault()
      act()
    },
    [enabled],
  )

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
    onDoubleClick,
    onKeyDown,
  }
}
