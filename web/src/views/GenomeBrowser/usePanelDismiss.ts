// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, type RefObject } from "react"

const EDITABLE = "input, textarea, select, [contenteditable]"
const PORTAL = ".MuiModal-root, .MuiPopper-root"

interface Options {
  panelRef: RefObject<HTMLElement | null>
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
}

export function usePanelDismiss({ panelRef, anchorRef, onClose }: Options) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const active = document.activeElement
      const inField =
        active instanceof HTMLElement &&
        panelRef.current?.contains(active) &&
        active.closest(EDITABLE)
      if (inField) {
        active.blur()
        return
      }
      onClose()
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (panelRef.current?.contains(target) || target.closest(PORTAL)) return
      // Let the button's click handler toggle the panel
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    window.addEventListener("keydown", onKeyDown)
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [panelRef, anchorRef, onClose])
}
