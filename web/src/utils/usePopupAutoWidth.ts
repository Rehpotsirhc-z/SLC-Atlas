// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, type RefObject } from "react"
import type { PanelSize } from "./useResizablePanel"

const BAR_TARGET = 190
const MAX_W = 640
const MIN_W = 280
const VIEWPORT_PAD = 16

function num(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

// Size a bar-list popup so its bars render at a constant target width
// regardless of how long the row labels are
export function usePopupAutoWidth(
  gridRef: RefObject<HTMLDivElement | null>,
  contentKey: string,
  panelX: number,
  panelH: number,
  onSizeChange: (size: PanelSize) => void,
) {
  const xRef = useRef(panelX)
  const hRef = useRef(panelH)
  const cbRef = useRef(onSizeChange)
  xRef.current = panelX
  hRef.current = panelH
  cbRef.current = onSizeChange

  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const rows = Array.from(grid.children) as HTMLElement[]
    if (!rows.length) return

    let maxLabel = 0
    let maxValue = 0
    let barPad = 0
    for (const row of rows) {
      const [label, barCell, value] = Array.from(row.children) as HTMLElement[]
      if (label) maxLabel = Math.max(maxLabel, label.scrollWidth)
      if (value) maxValue = Math.max(maxValue, value.offsetWidth)
      if (barCell) {
        const cs = getComputedStyle(barCell)
        barPad = Math.max(barPad, num(cs.paddingLeft) + num(cs.paddingRight))
      }
    }

    const gs = getComputedStyle(grid)
    const gap = num(gs.columnGap)
    const padX = num(gs.paddingLeft) + num(gs.paddingRight)

    const ideal = padX + maxLabel + gap + (BAR_TARGET + barPad) + gap + maxValue
    const available = window.innerWidth - xRef.current - VIEWPORT_PAD
    const target = Math.round(Math.max(MIN_W, Math.min(ideal, MAX_W, available)))

    cbRef.current({ w: target, h: hRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey])
}
