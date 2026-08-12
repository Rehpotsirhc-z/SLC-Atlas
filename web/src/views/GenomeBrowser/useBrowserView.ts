// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Keep gesture updates synchronized without rerendering every frame */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { VIEW_SETTLE_MS } from "./constants"
import { clampView, zoomAbout, type Viewport } from "./scale"

export type Painter = (view: Viewport) => void

export interface BrowserView {
  /** Where the view has settled, for readouts and anything derived */
  view: Viewport
  /** Where the view is right now, which during a drag is ahead of the state above */
  liveView: () => Viewport
  bounds: Viewport
  subscribe: (paint: Painter) => () => void
  /** Move without telling React, then repaint on the next frame */
  apply: (next: Viewport) => void
  /** Publish where the view ended up */
  commit: () => void
  /** Publish once the movement stops, for a gesture that arrives as a burst of events */
  settle: () => void
  /** Both at once, for a jump that has no gesture behind it */
  goTo: (next: Viewport) => void
  panBy: (bases: number) => void
  zoomBy: (factor: number, atBase?: number) => void
  reset: () => void
}

const same = (a: Viewport, b: Viewport) => a.start === b.start && a.end === b.end

export function useBrowserView(initial: Viewport, bounds: Viewport): BrowserView {
  const start = initial.start
  const end = initial.end
  const low = bounds.start
  const high = bounds.end

  const steady = useMemo(() => ({ start, end }), [start, end])
  const limits = useMemo(() => ({ start: low, end: high }), [low, high])

  const [view, setView] = useState<Viewport>(steady)
  const live = useRef<Viewport>(steady)
  const limitsRef = useRef(limits)
  const painters = useRef(new Set<Painter>())
  const frame = useRef(0)
  const pending = useRef(0)

  limitsRef.current = limits

  const paint = useCallback(() => {
    frame.current = 0
    for (const painter of painters.current) painter(live.current)
  }, [])

  const schedule = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(paint)
  }, [paint])

  const apply = useCallback(
    (next: Viewport) => {
      const clamped = clampView(next, limitsRef.current)
      if (same(clamped, live.current)) return
      live.current = clamped
      schedule()
    },
    [schedule],
  )

  const commit = useCallback(() => {
    clearTimeout(pending.current)
    pending.current = 0
    setView((current) => (same(current, live.current) ? current : live.current))
  }, [])

  const settle = useCallback(() => {
    clearTimeout(pending.current)
    pending.current = window.setTimeout(commit, VIEW_SETTLE_MS)
  }, [commit])

  const goTo = useCallback(
    (next: Viewport) => {
      apply(next)
      commit()
    },
    [apply, commit],
  )

  // A wheel and a held arrow key both arrive many times a second, so they move the view now and
  // say where it got to afterwards
  const panBy = useCallback(
    (bases: number) => {
      const { start: from, end: to } = live.current
      apply({ start: from + bases, end: to + bases })
      settle()
    },
    [apply, settle],
  )

  const zoomBy = useCallback(
    (factor: number, atBase?: number) => {
      const current = live.current
      const centre = atBase ?? (current.start + current.end) / 2
      apply(zoomAbout(current, factor, centre, limitsRef.current))
      settle()
    },
    [apply, settle],
  )

  const reset = useCallback(() => goTo(steady), [goTo, steady])

  const subscribe = useCallback((painter: Painter) => {
    painters.current.add(painter)
    painter(live.current)
    return () => {
      painters.current.delete(painter)
    }
  }, [])

  // A new gene brings a new window, and the live view has to follow it rather than keep
  // coordinates that belong to a different chromosome
  useEffect(() => {
    clearTimeout(pending.current)
    pending.current = 0
    live.current = clampView(steady, limits)
    setView(live.current)
    schedule()
  }, [steady, limits, schedule])

  useEffect(
    () => () => {
      clearTimeout(pending.current)
      cancelAnimationFrame(frame.current)
      // Cleared as well as cancelled. Strict mode runs this between the two mounts it makes,
      // and a handle left behind would tell every later schedule that a frame was already
      // pending, so nothing would ever repaint again
      frame.current = 0
    },
    [],
  )

  const liveView = useCallback(() => live.current, [])

  return {
    view,
    liveView,
    bounds: limits,
    subscribe,
    apply,
    commit,
    settle,
    goTo,
    panBy,
    zoomBy,
    reset,
  }
}
