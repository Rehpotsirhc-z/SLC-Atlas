// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef, useState } from "react"
import type { CellSize } from "@/types/heatmap"

interface HeatmapLayout {
  fits: boolean
  contentLeft: number
  cornerCollapsed: boolean
  searchCoversContent: boolean
}

type UpdateCellSize = (next: Partial<CellSize>) => void

export function useHeatmapResize(setCellSize: UpdateCellSize, layout: HeatmapLayout) {
  const [isResizingWidth, setIsResizingWidth] = useState(false)
  const layoutBeforeResize = useRef(layout)

  if (!isResizingWidth) {
    layoutBeforeResize.current = layout
  }

  const visibleLayout = isResizingWidth ? layoutBeforeResize.current : layout

  const setCellWidth = useCallback(
    (width: number) => {
      setIsResizingWidth(true)
      setCellSize({ width })
    },
    [setCellSize],
  )
  const finishCellWidthResize = useCallback(() => setIsResizingWidth(false), [])
  const setCellHeight = useCallback((height: number) => setCellSize({ height }), [setCellSize])
  const resetCellSize = useCallback(() => setCellSize({ width: null, height: null }), [setCellSize])

  return {
    setCellWidth,
    finishCellWidthResize,
    setCellHeight,
    resetCellSize,
    fits: visibleLayout.fits,
    contentOffsetLeft: isResizingWidth ? visibleLayout.contentLeft : undefined,
    cornerCollapsed: visibleLayout.cornerCollapsed,
    searchCoversContent: visibleLayout.searchCoversContent,
  }
}
