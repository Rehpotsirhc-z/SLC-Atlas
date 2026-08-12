// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Which lanes of the stack are on screen */

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { LANE_REVEAL_PX } from "./constants"

export type LaneWatch = (el: Element, onVisible: (visible: boolean) => void) => () => void

/**
 * Two dozen lanes scroll inside the frame and about eight are on screen, but a move repaints all
 * of them, so a lane off the frame skips the frame and catches up on its way back. One observer
 * for the stack rather than one per lane, the frame being the root every one of them shares.
 */
export function useLaneVisibility(frameRef: RefObject<HTMLElement | null>): LaneWatch {
  const watchers = useRef(new Map<Element, (visible: boolean) => void>())
  const observer = useRef<IntersectionObserver | null>(null)
  const rooted = useRef<HTMLElement | null>(null)

  useEffect(
    () => () => {
      observer.current?.disconnect()
      observer.current = null
    },
    [],
  )

  return useCallback<LaneWatch>(
    (el, onVisible) => {
      // Built on the first lane rather than on mount: the frame it is rooted at is attached
      // during the commit the lanes are mounted in, and rebuilt when a new frame replaces it
      const root = frameRef.current
      if (!root) return () => {}
      if (observer.current && rooted.current !== root) {
        observer.current.disconnect()
        observer.current = null
      }
      if (!observer.current) {
        rooted.current = root
        observer.current = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) watchers.current.get(entry.target)?.(entry.isIntersecting)
          },
          { root, rootMargin: `${LANE_REVEAL_PX}px 0px` },
        )
      }
      watchers.current.set(el, onVisible)
      observer.current.observe(el)
      return () => {
        watchers.current.delete(el)
        observer.current?.unobserve(el)
      }
    },
    [frameRef],
  )
}
