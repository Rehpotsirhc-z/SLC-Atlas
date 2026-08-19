// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"

export interface PanelPos {
  x: number
  y: number
}

export function useDraggablePanel(
  panelRef: RefObject<HTMLElement | null>,
  pos: PanelPos | null,
  onPosChange: (pos: PanelPos) => void,
  defaultPos: PanelPos,
  width: number,
  height: number,
  margin = 12,
) {
  const currentPos = pos ?? defaultPos
  const posRef = useRef(currentPos)
  posRef.current = currentPos

  useLayoutEffect(() => {
    if (pos !== null) return
    const panel = panelRef.current
    const container = panel?.parentElement
    if (!panel || !container) return
    const rect = container.getBoundingClientRect()
    const pad = margin
    const x = rect.left + defaultPos.x
    const y = rect.top + defaultPos.y
    const fitX = Math.max(pad, Math.min(x, window.innerWidth - width - pad))
    const fitY = Math.max(pad, Math.min(y, window.innerHeight - height - pad))
    onPosChange({ x: fitX, y: fitY })
  }, [pos, defaultPos, onPosChange, panelRef, width, height, margin])

  // Re-clamp when the width changes
  useEffect(() => {
    const pad = margin
    const clamp = () => {
      const cw = window.innerWidth
      const ch = window.innerHeight
      const p = posRef.current
      const x = Math.max(pad, Math.min(p.x, cw - width - pad))
      const y = Math.max(pad, Math.min(p.y, ch - height - pad))
      if (x !== p.x || y !== p.y) onPosChange({ x, y })
    }
    clamp()
    window.addEventListener("resize", clamp)
    return () => window.removeEventListener("resize", clamp)
  }, [onPosChange, width, height, margin])

  function startDrag(startX: number, startY: number) {
    const initX = currentPos.x
    const initY = currentPos.y
    const panel = panelRef.current

    document.body.style.userSelect = "none"
    document.body.style.cursor = "grabbing"

    let finalX = initX
    let finalY = initY

    function move(clientX: number, clientY: number) {
      const pad = 12
      let x = initX + (clientX - startX)
      let y = initY + (clientY - startY)
      if (panel) {
        const handleH = 28
        const grip = 40
        x = Math.max(pad - panel.offsetWidth + grip, Math.min(x, window.innerWidth - grip - pad))
        y = Math.max(pad, Math.min(y, window.innerHeight - handleH - pad))
      }
      finalX = x
      finalY = y
      if (panel) panel.style.transform = `translate(${x - initX}px, ${y - initY}px)`
    }

    function onMouseMove(e: MouseEvent) {
      move(e.clientX, e.clientY)
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      const t = e.touches[0]
      move(t.clientX, t.clientY)
    }
    function onEnd() {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onEnd)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onEnd)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
      if (panel) panel.style.transform = ""
      onPosChange({ x: finalX, y: finalY })
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onEnd)
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onEnd)
  }

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault()
    startDrag(e.clientX, e.clientY)
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    startDrag(t.clientX, t.clientY)
  }

  return { currentPos, handleDragStart, handleTouchStart }
}
