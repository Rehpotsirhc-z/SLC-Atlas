// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef } from "react"
import { useMediaQuery } from "@mui/material"
import { SNAKE, SNAKE_REVEAL } from "./constants"
import { beadAt, type SnakeLayout } from "./snakeLayout"

const ease = (t: number) => 1 - (1 - t) ** 3

const runFor = (distance: number) =>
  Math.min(Math.max(distance / SNAKE_REVEAL.pxPerMs, SNAKE_REVEAL.minMs), SNAKE_REVEAL.maxMs)

export function useSnakeReveal(layout: SnakeLayout, residue: number | null) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const frame = useRef<number | null>(null)
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")

  const at = useMemo(() => beadAt(layout, residue)?.bead.x ?? null, [layout, residue])

  useEffect(() => () => void (frame.current !== null && cancelAnimationFrame(frame.current)), [])

  useEffect(() => {
    const box = boxRef.current
    if (!box || at === null) return

    const scale = layout.width ? box.scrollWidth / layout.width : 1
    const x = at * scale
    const clearance = (SNAKE.bead + SNAKE_REVEAL.edgePad) * scale
    const view = box.clientWidth
    if (x - clearance >= box.scrollLeft && x + clearance <= box.scrollLeft + view) return

    const target = Math.max(0, Math.min(x - view / 2, box.scrollWidth - view))
    const from = box.scrollLeft
    if (Math.round(target) === Math.round(from)) return

    if (frame.current !== null) cancelAnimationFrame(frame.current)
    if (reduceMotion) {
      box.scrollLeft = target
      return
    }

    const run = runFor(Math.abs(target - from))
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const t = Math.min((now - start) / run, 1)
      box.scrollLeft = from + (target - from) * ease(t)
      frame.current = t < 1 ? requestAnimationFrame(step) : null
    }
    frame.current = requestAnimationFrame(step)
  }, [at, layout.width, reduceMotion])

  return boxRef
}
