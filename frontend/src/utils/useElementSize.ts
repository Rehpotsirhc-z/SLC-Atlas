// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState } from "react"

export interface ElementSize {
  w: number
  h: number
}

export function useElementSize<T extends HTMLElement>(box: "client" | "offset" = "client") {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = box === "offset" ? el.offsetWidth : el.clientWidth
      const h = box === "offset" ? el.offsetHeight : el.clientHeight
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [box])

  return [ref, size] as const
}
