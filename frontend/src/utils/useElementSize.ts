// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState, type RefObject } from "react"

export interface ElementSize {
  w: number
  h: number
}

// Callable so a late-mounting element is measured when it arrives, a ref object so callers
// can still read .current
export type SizedRef<T> = ((el: T | null) => void) & RefObject<T | null>

// "content" reports the fractional content box; the other two round to integers
export function useElementSize<T extends HTMLElement>(
  box: "client" | "offset" | "content" = "client",
) {
  const [size, setSize] = useState<ElementSize>({ w: 0, h: 0 })
  const observer = useRef<ResizeObserver | null>(null)

  const ref = useMemo(() => {
    const attach = ((el: T | null) => {
      attach.current = el
      observer.current?.disconnect()
      observer.current = null
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
      observer.current = new ResizeObserver(([entry]) => apply(entry.contentRect))
      observer.current.observe(el)
    }) as SizedRef<T>
    attach.current = null
    return attach
  }, [box])

  useEffect(() => () => observer.current?.disconnect(), [])

  return [ref, size] as const
}
