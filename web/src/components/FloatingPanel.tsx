// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// A draggable, resizable panel shared by floating readouts

import { useLayoutEffect, useRef, type ReactNode } from "react"
import CloseIcon from "@mui/icons-material/Close"
import { Box, Divider, IconButton, Paper, Typography, useTheme } from "@mui/material"
import ResizeHandles from "@/components/ResizeHandles"
import { glowFlash } from "@/theme"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { useFloatingWindow } from "@/utils/useFloatingWindow"
import { useResizablePanel, type PanelSize } from "@/utils/useResizablePanel"

export interface StatRow {
  label: string
  value: ReactNode
}

interface Props {
  accent: string
  title: ReactNode
  idLine?: ReactNode
  nameLine?: ReactNode
  statRows?: StatRow[]
  footer?: ReactNode
  onClose: () => void
  pos: PanelPos | null
  onPosChange: (pos: PanelPos) => void
  size: PanelSize | null
  onSizeChange: (size: PanelSize) => void
  defaultPos: PanelPos
  defaultWidth: number
  defaultHeight: number
  minWidth: number
  minHeight: number
  windowKey: string
  children?: ReactNode
}

export default function FloatingPanel({
  accent,
  title,
  idLine,
  nameLine,
  statRows,
  footer,
  onClose,
  pos,
  onPosChange,
  size,
  onSizeChange,
  defaultPos,
  defaultWidth,
  defaultHeight,
  minWidth,
  minHeight,
  windowKey,
  children,
}: Props) {
  const { custom } = useTheme()
  const panelRef = useRef<HTMLDivElement>(null)
  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    onPosChange,
    defaultPos,
  )
  const width = Math.max(size?.w ?? defaultWidth, minWidth)
  const height = Math.max(size?.h ?? defaultHeight, minHeight)
  const currentSize = { w: width, h: height }
  useLayoutEffect(() => {
    if (!size || size.w < minWidth || size.h < minHeight) onSizeChange(currentSize)
  }, [size, width, height, minWidth, minHeight, onSizeChange])
  const { startResize } = useResizablePanel(
    currentPos,
    onPosChange,
    currentSize,
    onSizeChange,
    minWidth,
    minHeight,
  )
  const { zIndex, focusProps } = useFloatingWindow(windowKey)

  const dragProps = { onMouseDown: handleDragStart, onTouchStart: handleTouchStart }

  return (
    <Paper
      ref={panelRef}
      elevation={6}
      {...focusProps}
      sx={{
        position: "fixed",
        top: currentPos.y,
        left: currentPos.x,
        width: currentSize.w,
        height: currentSize.h,
        zIndex,
        border: 1,
        borderColor: "divider",
        animation: `${glowFlash} 0.8s ease-out`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        {...dragProps}
        sx={{
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          px: 1.5,
          py: 0.875,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
      >
        <Box sx={{ width: "52%", height: 3, borderRadius: 1.5, bgcolor: "divider" }} />
      </Box>

      <Box sx={{ px: 1.5, pt: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: accent, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ mt: -0.5, mr: -0.5, color: "text.secondary" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {idLine && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              fontFamily: custom.monoFontFamily,
              fontSize: custom.monoFontSize,
            }}
          >
            {idLine}
          </Typography>
        )}
        {nameLine && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {nameLine}
          </Typography>
        )}

        {statRows && statRows.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                columnGap: 1.5,
                rowGap: 0.75,
              }}
            >
              {statRows.map((r) => (
                <Box key={r.label} sx={{ display: "contents" }}>
                  <Typography variant="caption" color="text.secondary">
                    {r.label}
                  </Typography>
                  <Typography variant="caption" sx={{ textAlign: "right" }}>
                    {r.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        {children && <Divider sx={{ mt: 1, mb: 0.75 }} />}
      </Box>

      {children ?? <Box sx={{ flex: 1, minHeight: 0 }} />}

      {footer && (
        <Box sx={{ px: 1.5, pb: 1.5, pt: children ? 0.75 : 1, flexShrink: 0 }}>{footer}</Box>
      )}

      <ResizeHandles onResize={startResize} />
    </Paper>
  )
}
