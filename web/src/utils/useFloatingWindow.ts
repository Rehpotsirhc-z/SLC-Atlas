// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect } from "react"
import { useUIStore } from "@/store/uiStore"

// Floating windows sit above every in-view layer
const BASE_Z = 5

export function useFloatingWindow(key: string) {
  const stack = useUIStore((s) => s.windowStack)
  const raise = useUIStore((s) => s.raiseWindow)
  const bringToFront = useCallback(() => raise(key), [raise, key])

  useEffect(() => bringToFront(), [bringToFront])

  const index = stack.indexOf(key)
  return {
    zIndex: BASE_Z + (index < 0 ? 0 : index + 1),
    bringToFront,
    // Capture phase so children that stop propagation still raise the window
    focusProps: { onPointerDownCapture: bringToFront },
  }
}
