// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState } from "react"

function intrinsicWidth(el: HTMLElement) {
  const style = getComputedStyle(el)
  let width = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  for (const child of Array.from(el.children) as HTMLElement[]) {
    const childStyle = getComputedStyle(child)
    width +=
      child.getBoundingClientRect().width +
      parseFloat(childStyle.marginLeft) +
      parseFloat(childStyle.marginRight)
  }
  return width
}

export function useRowFits(count: number, gap: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(true)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const items = Array.from(el.children) as HTMLElement[]
      if (items.length < 2) return setFits(true)
      const natural = items.reduce((sum, item) => sum + intrinsicWidth(item), 0)
      setFits(natural + gap * (items.length - 1) <= el.getBoundingClientRect().width)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener("resize", measure)
    void document.fonts?.ready.then(measure)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [count, gap])

  return [ref, fits] as const
}
