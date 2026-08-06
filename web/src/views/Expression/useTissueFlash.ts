// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { useMediaQuery } from "@mui/material"
import { LEFT_COL_W } from "@/components/heatmap/constants"
import { TISSUE_FLASH_MS, TISSUE_FLASH_MS_REDUCED } from "./constants"

interface Options {
  containerRef: RefObject<HTMLDivElement | null>
  tissueCols: string[]
  cellW: number
}

export function useTissueFlash({ containerRef, tissueCols, cellW }: Options) {
  const [flashCols, setFlashCols] = useState<Set<number>>(new Set())
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")

  const flashSpans = useMemo(() => {
    const sorted = [...flashCols].sort((a, b) => a - b)
    const spans: [number, number][] = []
    for (const col of sorted) {
      const last = spans[spans.length - 1]
      if (last && col === last[1] + 1) last[1] = col
      else spans.push([col, col])
    }
    return spans
  }, [flashCols])

  const focusTissue = useCallback(
    (tissue: string | string[]) => {
      const cols = (Array.isArray(tissue) ? tissue : [tissue])
        .map((t) => tissueCols.indexOf(t))
        .filter((col) => col >= 0)
      if (cols.length === 0) return
      const c = containerRef.current
      if (c) {
        const minCol = Math.min(...cols)
        const maxCol = Math.max(...cols)
        const midX = ((minCol + maxCol + 1) / 2) * cellW
        const target = midX - (c.clientWidth - LEFT_COL_W) / 2
        const max = c.scrollWidth - c.clientWidth
        c.scrollTo({
          left: Math.max(0, Math.min(max, target)),
          behavior: reduceMotion ? "auto" : "smooth",
        })
      }
      if (flashTimer.current) clearTimeout(flashTimer.current)
      setFlashCols(new Set(cols))
      flashTimer.current = setTimeout(
        () => setFlashCols(new Set()),
        reduceMotion ? TISSUE_FLASH_MS_REDUCED : TISSUE_FLASH_MS,
      )
    },
    [containerRef, tissueCols, cellW, reduceMotion],
  )

  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), [])

  return { flashSpans, focusTissue, reduceMotion }
}
