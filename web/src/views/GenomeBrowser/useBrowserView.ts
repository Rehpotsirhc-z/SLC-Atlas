// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Keep gesture updates synchronized without rerendering every frame */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { VIEW_REST_MS, VIEW_SETTLE_MS } from "./constants"
import { clampView, zoomAbout, type Viewport } from "./scale"

export type Painter = (view: Viewport) => void

export interface BrowserView {
  /** Where the view has settled, for readouts and anything derived */
  view: Viewport
  /** Where the view is right now, which during a drag is ahead of the state above */
  liveView: () => Viewport
  /** Whether the view is mid-gesture, for anything that should hold still until it stops */
  moving: () => boolean
  bounds: Viewport
  subscribe: (paint: Painter) => () => void
  /** Move without telling React, then repaint on the next frame */
  apply: (next: Viewport) => void
  /** Publish where the view ended up, and call the movement over */
  commit: () => void
  /** For a gesture that arrives as a burst of events and never says when it is done */
  settle: () => void
  /** For a gesture that announces its own end, like a button coming up */
  release: () => void
  /** Publish and come to rest at once, for a jump that has no gesture behind it */
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
  const settling = useRef(0)
  const inFlight = useRef(false)

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
      inFlight.current = true
      // Moving again means the gesture was not over after all, so anything waiting on it stands
      // down rather than landing in the middle of it
      clearTimeout(pending.current)
      pending.current = 0
      clearTimeout(settling.current)
      settling.current = 0
      schedule()
    },
    [schedule],
  )

  /** Publish the live viewport to React and trigger any required data loading. */
  const publish = useCallback(() => {
    clearTimeout(pending.current)
    pending.current = 0
    setView((current) => (same(current, live.current) ? current : live.current))
  }, [])

  /** Mark the movement complete after brief pauses used to continue the same gesture. */
  const rest = useCallback(() => {
    clearTimeout(settling.current)
    settling.current = window.setTimeout(() => {
      settling.current = 0
      inFlight.current = false
      // Repaint once so lanes can adopt their resting scale
      schedule()
    }, VIEW_REST_MS)
  }, [schedule])

  const commit = useCallback(() => {
    clearTimeout(settling.current)
    settling.current = 0
    inFlight.current = false
    schedule()
    publish()
  }, [schedule, publish])

  const settle = useCallback(() => {
    clearTimeout(pending.current)
    pending.current = window.setTimeout(publish, VIEW_SETTLE_MS)
    rest()
  }, [publish, rest])

  const release = useCallback(() => {
    publish()
    rest()
  }, [publish, rest])

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
    clearTimeout(settling.current)
    settling.current = 0
    inFlight.current = false
    live.current = clampView(steady, limits)
    setView(live.current)
    schedule()
  }, [steady, limits, schedule])

  useEffect(
    () => () => {
      clearTimeout(pending.current)
      clearTimeout(settling.current)
      cancelAnimationFrame(frame.current)
      // Cleared as well as cancelled. Strict mode runs this between the two mounts it makes,
      // and a handle left behind would tell every later schedule that a frame was already
      // pending, so nothing would ever repaint again
      frame.current = 0
    },
    [],
  )

  const liveView = useCallback(() => live.current, [])
  const moving = useCallback(() => inFlight.current, [])

  return {
    view,
    liveView,
    moving,
    bounds: limits,
    subscribe,
    apply,
    commit,
    settle,
    release,
    goTo,
    panBy,
    zoomBy,
    reset,
  }
}
