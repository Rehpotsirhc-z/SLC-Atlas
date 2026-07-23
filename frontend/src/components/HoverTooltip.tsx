// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Box } from "@mui/material"
import type { SxProps, Theme } from "@mui/material"
import { tooltipSurfaceSx } from "@/theme"

interface HoverTooltipProps {
  x: number // cursor position in viewport coordinates (clientX)
  y: number // cursor position in viewport coordinates (clientY)
  maxWidth?: number
  children: React.ReactNode
  sx?: SxProps<Theme>
}

export default function HoverTooltip({ x, y, maxWidth = 260, children, sx }: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const tip = ref.current
    if (!tip) return
    const margin = 8
    let left = x + 14
    let top = y + 14
    if (left + tip.offsetWidth + margin > window.innerWidth) left = x - 14 - tip.offsetWidth
    if (top + tip.offsetHeight + margin > window.innerHeight) top = y - 14 - tip.offsetHeight
    left = Math.max(margin, left)
    top = Math.max(margin, top)
    setPos({ left, top })
  }, [x, y])

  return createPortal(
    <Box
      ref={ref}
      sx={[
        {
          position: "fixed",
          left: pos ? pos.left : x + 14,
          top: pos ? pos.top : y + 14,
          pointerEvents: "none",
          zIndex: (t) => t.zIndex.tooltip,
          px: 1,
          maxWidth,
        },
        tooltipSurfaceSx,
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>,
    document.body,
  )
}
