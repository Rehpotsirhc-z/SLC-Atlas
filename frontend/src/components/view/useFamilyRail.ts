// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

export const RAIL_MIN_WIDTH = 200
export const RAIL_MAX_WIDTH = 600
export const RAIL_DEFAULT_WIDTH = 280
export const RAIL_DRAWER_WIDTH = 280
// Width of the drag handle between the rail and the content pane
export const RAIL_SPLITTER_WIDTH = 16

interface Options {
  // Narrowest the content pane may get before the rail folds into a drawer
  minContentWidth: number
  // Skip measuring while data is still loading or the layout is already single-column
  enabled: boolean
}

// Shrink the rail to its minimum before folding it into a drawer
export function useFamilyRail({ minContentWidth, enabled }: Options) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT_WIDTH)
  const [useDrawer, setUseDrawer] = useState(false)
  const [contentWidth, setContentWidth] = useState(0)
  const railWidthRef = useRef(railWidth)
  const dragging = useRef(false)
  const expanded = useRef(false)

  useEffect(() => {
    railWidthRef.current = railWidth
  }, [railWidth])

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!enabled || !outer || !minContentWidth) return

    const checkFit = () => {
      const outerW = outer.clientWidth

      const inline = outerW - railWidthRef.current - RAIL_SPLITTER_WIDTH
      if (inline >= minContentWidth) {
        setUseDrawer(false)
        setContentWidth(inline)
        return
      }

      const atMinimum = outerW - RAIL_MIN_WIDTH - RAIL_SPLITTER_WIDTH
      if (atMinimum >= minContentWidth) {
        if (railWidthRef.current > RAIL_MIN_WIDTH) setRailWidth(RAIL_MIN_WIDTH)
        setUseDrawer(false)
        setContentWidth(atMinimum)
        return
      }

      setUseDrawer(true)
      setContentWidth(outerW)
    }

    checkFit()
    const ro = new ResizeObserver(checkFit)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [enabled, minContentWidth])

  // Hand the content pane's leftover space to the rail, once, on first measure
  const expandRail = useCallback((naturalContentWidth: number) => {
    const outer = outerRef.current
    if (expanded.current || !outer || !naturalContentWidth) return
    expanded.current = true
    const current = railWidthRef.current
    const slack = outer.clientWidth - current - RAIL_SPLITTER_WIDTH - naturalContentWidth
    if (slack > 0) setRailWidth(Math.min(RAIL_MAX_WIDTH, current + slack))
  }, [])

  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true
    const startX = e.clientX
    const startWidth = railWidthRef.current
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setRailWidth(
        Math.max(RAIL_MIN_WIDTH, Math.min(RAIL_MAX_WIDTH, startWidth + ev.clientX - startX)),
      )
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  return { outerRef, railWidth, expandRail, useDrawer, contentWidth, onDragStart }
}
