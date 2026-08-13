// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Which lanes of the stack are on screen */

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react"
import { LANE_REVEAL_PX } from "./constants"

export type LaneWatch = (el: Element, onVisible: (visible: boolean) => void) => () => void

export interface LaneVisibility {
  /** Register a lane's canvas under a name, so what is on screen can be asked for by it */
  watch: (el: Element, key: string, onVisible: (visible: boolean) => void) => () => void
  /** Whether a lane is on screen, which is what decides whose bytes are read first */
  isVisible: (key: string) => boolean
}

/**
 * Two dozen lanes scroll inside the frame and about eight are on screen, but a move repaints all
 * of them, so a lane off the frame skips the frame and catches up on its way back. One observer
 * for the stack rather than one per lane, the frame being the root every one of them shares.
 */
export function useLaneVisibility(frameRef: RefObject<HTMLElement | null>): LaneVisibility {
  const watchers = useRef(new Map<Element, { key: string; onVisible: (v: boolean) => void }>())
  const shown = useRef(new Set<string>())
  // Until the observer has said anything the whole stack counts as on screen, which for the first
  // read is right: the frame opens at the top, so the lanes asking first are the lanes in view
  const reported = useRef(false)
  const observer = useRef<IntersectionObserver | null>(null)
  const rooted = useRef<HTMLElement | null>(null)

  useEffect(
    () => () => {
      observer.current?.disconnect()
      observer.current = null
    },
    [],
  )

  const watch = useCallback<LaneVisibility["watch"]>(
    (el, key, onVisible) => {
      // Built on the first lane rather than on mount: the frame it is rooted at is attached
      // during the commit the lanes are mounted in, and rebuilt when a new frame replaces it
      const root = frameRef.current
      if (!root) return () => {}
      if (observer.current && rooted.current !== root) {
        observer.current.disconnect()
        observer.current = null
        // A new observer has said nothing yet, and what the old one saw was of another frame
        reported.current = false
      }
      if (!observer.current) {
        rooted.current = root
        observer.current = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const held = watchers.current.get(entry.target)
              if (!held) continue
              if (entry.isIntersecting) shown.current.add(held.key)
              else shown.current.delete(held.key)
              held.onVisible(entry.isIntersecting)
            }
            reported.current = true
          },
          { root, rootMargin: `${LANE_REVEAL_PX}px 0px` },
        )
      }
      watchers.current.set(el, { key, onVisible })
      observer.current.observe(el)
      return () => {
        watchers.current.delete(el)
        shown.current.delete(key)
        observer.current?.unobserve(el)
      }
    },
    [frameRef],
  )

  const isVisible = useCallback((key: string) => !reported.current || shown.current.has(key), [])

  return useMemo(() => ({ watch, isVisible }), [watch, isVisible])
}
