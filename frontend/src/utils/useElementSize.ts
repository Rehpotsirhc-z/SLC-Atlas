// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState } from "react"

interface ElementSize {
  w: number
  h: number
}

// "content" reports the fractional content box; the other two round to integers
export function useElementSize<T extends HTMLElement>(
  box: "client" | "offset" | "content" = "client",
) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (rect?: DOMRectReadOnly) => {
      if (box === "content" && rect) return { w: rect.width, h: rect.height }
      if (box === "offset") return { w: el.offsetWidth, h: el.offsetHeight }
      return { w: el.clientWidth, h: el.clientHeight }
    }
    const apply = (rect?: DOMRectReadOnly) => {
      const next = measure(rect)
      setSize((s) => (s.w === next.w && s.h === next.h ? s : next))
    }
    apply(box === "content" ? el.getBoundingClientRect() : undefined)
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect))
    ro.observe(el)
    return () => ro.disconnect()
  }, [box])

  return [ref, size] as const
}
