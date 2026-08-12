// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/** Read the pointer no more than once a frame */

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Pointer events can arrive faster than the screen redraws. Process only the last event in each
 * frame.
 *
 * `read` is called with the event's own coordinates rather than the event, a pointer event
 * being recycled by the time the frame runs.
 */
export function useHoverFrame<T>(
  read: (clientX: number, clientY: number) => T | null,
  same: (a: T | null, b: T | null) => boolean,
) {
  const [hovered, setHovered] = useState<T | null>(null)
  const at = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)
  const latest = useRef(read)
  latest.current = read
  const matches = useRef(same)
  matches.current = same

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const run = useCallback(() => {
    frame.current = 0
    const point = at.current
    const found = point ? latest.current(point.x, point.y) : null
    setHovered((current) => (matches.current(current, found) ? current : found))
  }, [])

  const onMove = useCallback(
    (clientX: number, clientY: number) => {
      at.current = { x: clientX, y: clientY }
      if (frame.current) return
      frame.current = requestAnimationFrame(run)
    },
    [run],
  )

  const clear = useCallback(() => {
    at.current = null
    cancelAnimationFrame(frame.current)
    frame.current = 0
    setHovered((current) => (current === null ? current : null))
  }, [])

  return { hovered, onMove, clear }
}
