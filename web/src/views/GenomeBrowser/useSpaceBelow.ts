// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useState, type RefObject } from "react"

// Measure the space below an element within its boundary
export function useSpaceBelow(
  ref: RefObject<HTMLElement | null>,
  boundaryRef: RefObject<HTMLElement | null>,
  gutter: number,
  active: boolean,
) {
  const [space, setSpace] = useState(0)

  useLayoutEffect(() => {
    if (!active) return
    let frame = 0
    const measure = () => {
      const el = ref.current
      if (!el) return
      const foot = boundaryRef.current?.getBoundingClientRect().bottom ?? window.innerHeight
      setSpace(Math.max(0, foot - el.getBoundingClientRect().bottom - gutter))
    }
    // A toolbar that wraps moves the element a commit after the resize that wrapped it, so the
    // frame after a change is measured as well as the change itself
    const remeasure = () => {
      measure()
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    remeasure()
    const observer = new ResizeObserver(remeasure)
    if (ref.current) observer.observe(ref.current)
    if (boundaryRef.current) observer.observe(boundaryRef.current)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [ref, boundaryRef, gutter, active])

  return space
}
