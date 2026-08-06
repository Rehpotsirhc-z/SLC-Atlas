// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { PointerEvent as ReactPointerEvent } from "react"
import type { PanelPos } from "./useDraggablePanel"

export interface PanelSize {
  w: number
  h: number
}

export interface ResizeDirs {
  top?: boolean
  bottom?: boolean
  left?: boolean
  right?: boolean
}

export function useResizablePanel(
  currentPos: PanelPos,
  onPosChange: (pos: PanelPos) => void,
  size: PanelSize,
  onSizeChange: (size: PanelSize) => void,
  minW: number,
  minH: number,
) {
  function startResize(e: ReactPointerEvent, dirs: ResizeDirs) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const s = { x: currentPos.x, y: currentPos.y, w: size.w, h: size.h }
    const pad = 8
    const onMove = (ev: PointerEvent) => {
      let { x, y, w, h } = s
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (dirs.right) w = Math.max(minW, Math.min(s.w + dx, window.innerWidth - s.x - pad))
      if (dirs.bottom) h = Math.max(minH, Math.min(s.h + dy, window.innerHeight - s.y - pad))
      if (dirs.left) {
        const right = s.x + s.w
        w = Math.max(minW, Math.min(s.w - dx, right - pad))
        x = right - w
      }
      if (dirs.top) {
        const bottom = s.y + s.h
        h = Math.max(minH, Math.min(s.h - dy, bottom - pad))
        y = bottom - h
      }
      onSizeChange({ w, h })
      if (dirs.left || dirs.top) onPosChange({ x, y })
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return { startResize }
}
