// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from "react"
import { useUIStore, type PopupContent } from "./uiStore"

// `ready` gates clearing so a pending refetch doesn't blink the panel away
export function usePublishPopup(content: PopupContent | null, ready: boolean) {
  const setPopupContent = useUIStore((s) => s.setPopupContent)
  useEffect(() => {
    if (!ready) return
    setPopupContent(content)
  }, [content, ready, setPopupContent])
}
