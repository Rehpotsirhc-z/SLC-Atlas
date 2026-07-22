// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, RefObject } from "react"
import { Box, useTheme } from "@mui/material"
import { BOTTOM_PAD, LEFT_COL_W, LEFT_GUTTER, LEGEND_W } from "./constants"

interface HeatmapShellProps {
  containerRef: RefObject<HTMLDivElement | null>
  headerRef: RefObject<HTMLDivElement | null>
  contentW: number
  fits: boolean
  cornerSlot?: ReactNode
  cornerMinHeight?: number
  headerSlot: ReactNode
  sidebar: ReactNode
  showLegend: boolean
  legendSlot?: ReactNode
  headerH: number
  containerH: number
  overlay?: ReactNode
  onBackgroundClick: () => void
  onPointerLeave: () => void
  children: ReactNode
}

export default function HeatmapShell({
  containerRef,
  headerRef,
  contentW,
  fits,
  cornerSlot,
  cornerMinHeight,
  headerSlot,
  sidebar,
  showLegend,
  legendSlot,
  headerH,
  containerH,
  overlay,
  onBackgroundClick,
  onPointerLeave,
  children,
}: HeatmapShellProps) {
  const stickyBg = useTheme().palette.background.paper

  return (
    <Box
      ref={containerRef}
      sx={{ position: "relative", width: "100%", height: "100%", overflow: "auto" }}
      onPointerLeave={onPointerLeave}
      onClick={onBackgroundClick}
    >
      <Box sx={{ width: contentW, ml: fits ? "auto" : 0, mr: fits ? "auto" : 0 }}>
        <Box
          ref={headerRef}
          sx={{ position: "sticky", top: 0, zIndex: 3, display: "flex", bgcolor: stickyBg }}
        >
          <Box
            sx={{
              position: fits ? "static" : "sticky",
              left: 0,
              zIndex: 1,
              width: LEFT_COL_W,
              pl: LEFT_GUTTER / 8,
              flexShrink: 0,
              bgcolor: stickyBg,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minHeight: cornerMinHeight,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {cornerSlot}
          </Box>
          {headerSlot}
        </Box>

        <Box sx={{ display: "flex" }}>
          <Box
            sx={{
              position: fits ? "static" : "sticky",
              left: 0,
              zIndex: 2,
              width: LEFT_COL_W,
              pl: LEFT_GUTTER / 8,
              flexShrink: 0,
              bgcolor: stickyBg,
            }}
          >
            {sidebar}
          </Box>

          {children}

          {showLegend && (
            <Box
              sx={{
                flexShrink: 0,
                width: LEGEND_W,
                pl: 1.5,
                position: "sticky",
                top: headerH,
                height: Math.max(0, containerH - headerH),
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "stretch",
              }}
            >
              <Box onClick={(e) => e.stopPropagation()}>{legendSlot}</Box>
            </Box>
          )}
        </Box>

        <Box sx={{ height: BOTTOM_PAD }} />
      </Box>

      {overlay}
    </Box>
  )
}
