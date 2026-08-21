// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, RefObject } from "react"
import { Box, useTheme } from "@mui/material"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import { BOTTOM_PAD, GENE_TOGGLE_W, LEFT_GUTTER, LEGEND_W } from "./constants"

interface HeatmapShellProps {
  containerRef: RefObject<HTMLDivElement | null>
  headerRef: RefObject<HTMLDivElement | null>
  contentW: number
  fits: boolean
  contentOffsetLeft?: number
  leftColW: number
  cornerSlot?: ReactNode
  headerSlot: ReactNode
  sidebar: ReactNode
  showGeneTree?: boolean
  onToggleGeneTree?: () => void
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
  contentOffsetLeft,
  leftColW,
  cornerSlot,
  headerSlot,
  sidebar,
  showGeneTree = true,
  onToggleGeneTree,
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
      <Box
        sx={{
          width: contentW,
          ml: contentOffsetLeft != null ? `${contentOffsetLeft}px` : fits ? "auto" : 0,
          mr: contentOffsetLeft != null ? 0 : fits ? "auto" : 0,
        }}
      >
        <Box
          ref={headerRef}
          sx={{ position: "sticky", top: 0, zIndex: 3, display: "flex", bgcolor: stickyBg }}
        >
          <Box
            sx={{
              position: fits ? "static" : "sticky",
              left: 0,
              zIndex: 1,
              width: leftColW,
              pl: LEFT_GUTTER / 8,
              flexShrink: 0,
              bgcolor: stickyBg,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
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
              width: leftColW,
              pl: LEFT_GUTTER / 8,
              flexShrink: 0,
              bgcolor: stickyBg,
              display: "flex",
            }}
          >
            {sidebar}
            {onToggleGeneTree && (
              <Box
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleGeneTree()
                }}
                sx={{
                  ml: "auto",
                  width: GENE_TOGGLE_W,
                  flexShrink: 0,
                  cursor: "pointer",
                  color: "text.disabled",
                }}
              >
                <Box
                  sx={{
                    position: "sticky",
                    top: headerH,
                    height: `min(100%, ${Math.max(0, containerH - headerH)}px)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 0,
                  }}
                >
                  {showGeneTree ? (
                    <ChevronLeftIcon sx={{ fontSize: 12, display: "block" }} />
                  ) : (
                    <ChevronRightIcon sx={{ fontSize: 12, display: "block" }} />
                  )}
                </Box>
              </Box>
            )}
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
