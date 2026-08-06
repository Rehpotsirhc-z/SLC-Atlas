// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { startTransition, useEffect, useState } from "react"

const WARM_TIMEOUT_MS = 3000
const WARM_FALLBACK_MS = 1200

interface Options {
  active: boolean
  open: boolean
  ready: boolean
}

export function useDrawerWarmup({ active, open, ready }: Options) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted || !active) return
    if (open) {
      setMounted(true)
      return
    }
    if (!ready) return

    const warm = () => startTransition(() => setMounted(true))
    if (!window.requestIdleCallback) {
      const timer = window.setTimeout(warm, WARM_FALLBACK_MS)
      return () => window.clearTimeout(timer)
    }
    const handle = window.requestIdleCallback(warm, { timeout: WARM_TIMEOUT_MS })
    return () => window.cancelIdleCallback(handle)
  }, [mounted, active, open, ready])

  return mounted
}
