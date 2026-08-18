// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef } from "react"
import { RAIL_MIN_WIDTH } from "@/store/uiStore"
import { aspectRatioOf } from "./svgAssets"
import type { RailView } from "./tissueMaps"

// Slack so a fractional layout height never clips the figure by a pixel
const SAFETY_PX = 2

interface Options {
  view: RailView
  maxWidth: number
  onAutoWidth: (px: number) => void
  onFillWidth: (px: number) => void
}

// Widens the rail so the figure fills the available height without scrolling
export function useRailAutoWidth({ view, maxWidth, onAutoWidth, onFillWidth }: Options) {
  const rootRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const figureWrapRef = useRef<HTMLDivElement>(null)
  const aspectRatio = aspectRatioOf(view)

  useLayoutEffect(() => {
    const root = rootRef.current
    const header = headerRef.current
    const figureWrap = figureWrapRef.current
    if (!root || !header || !figureWrap) return

    const figureStyle = getComputedStyle(figureWrap)
    const padX = parseFloat(figureStyle.paddingLeft) + parseFloat(figureStyle.paddingRight)
    const padY = parseFloat(figureStyle.paddingTop) + parseFloat(figureStyle.paddingBottom)

    const recompute = () => {
      const availableH = Math.max(0, root.clientHeight - header.offsetHeight - padY - SAFETY_PX)
      const fillWidth = availableH * aspectRatio + padX
      onFillWidth(Math.round(Math.max(fillWidth, RAIL_MIN_WIDTH)))
      onAutoWidth(Math.round(Math.min(Math.max(fillWidth, RAIL_MIN_WIDTH), maxWidth)))
    }

    recompute()
    let lastHeight = root.clientHeight
    const ro = new ResizeObserver(() => {
      if (root.clientHeight !== lastHeight) {
        lastHeight = root.clientHeight
        recompute()
      }
    })
    ro.observe(root)
    return () => ro.disconnect()
  }, [aspectRatio, maxWidth, onAutoWidth, onFillWidth])

  return { rootRef, headerRef, figureWrapRef }
}
