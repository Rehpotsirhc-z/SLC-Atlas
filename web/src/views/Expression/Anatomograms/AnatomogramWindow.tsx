// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useRef } from "react"
import { Box, IconButton, Paper, Tooltip } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import ResizeHandles from "@/components/ResizeHandles"
import { useUIStore } from "@/store/uiStore"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { useFloatingWindow } from "@/utils/useFloatingWindow"
import { useResizablePanel } from "@/utils/useResizablePanel"
import { useViewportSize } from "@/utils/useViewportSize"
import AnatomogramAttribution from "./Attribution"
import AnatomogramHeader from "./AnatomogramHeader"
import FigureFrame from "./FigureFrame"
import { PopInIcon } from "./icons"
import type { RailView } from "./tissueMaps"

const DEFAULT_POS: PanelPos = { x: 64, y: 96 }
const MIN_W = 260
const MIN_H = 280
const VIEWPORT_INSET = 24

interface AnatomogramWindowProps {
  view: RailView
  presentTissues: Set<string>
  selectedTissue: string | null
  tpmByTissue: Map<string, number> | null
  domainMax: number
  onPickSex: (sex: "female" | "male") => void
  onPickBrain: () => void
  onPickTissue: (tissues: string[]) => void
  onClose: () => void
  onPopIn: () => void
  hideDock: boolean
}

export default function AnatomogramWindow({
  view,
  presentTissues,
  selectedTissue,
  tpmByTissue,
  domainMax,
  onPickSex,
  onPickBrain,
  onPickTissue,
  onClose,
  onPopIn,
  hideDock,
}: AnatomogramWindowProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const size = useUIStore((s) => s.railFloatSize)
  const pos = useUIStore((s) => s.railFloatPos)
  const setPos = useUIStore((s) => s.setRailFloatPos)
  const setSize = useUIStore((s) => s.setRailFloatSize)

  const vp = useViewportSize()
  const panelW = Math.min(size.w, vp.w - VIEWPORT_INSET)
  const panelH = Math.min(size.h, vp.h - VIEWPORT_INSET)

  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    setPos,
    DEFAULT_POS,
    panelW,
    panelH,
  )
  const { startResize } = useResizablePanel(currentPos, setPos, size, setSize, MIN_W, MIN_H)
  const { zIndex, focusProps } = useFloatingWindow("anatomogram")
  const dragProps = {
    onMouseDown: handleDragStart,
    onTouchStart: handleTouchStart,
    onDoubleClick: hideDock ? undefined : onPopIn,
  }

  return (
    <Paper
      ref={panelRef}
      elevation={6}
      {...focusProps}
      sx={{
        position: "fixed",
        top: currentPos.y,
        left: currentPos.x,
        width: panelW,
        height: panelH,
        zIndex,
        border: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        {...dragProps}
        sx={{
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 0.875,
        }}
      >
        <Box sx={{ width: "52%", height: 3, borderRadius: 1.5, bgcolor: "divider" }} />
      </Box>

      <AnatomogramHeader
        view={view}
        onPickSex={onPickSex}
        onPickBrain={onPickBrain}
        dragProps={dragProps}
        sx={{ cursor: "grab", "&:active": { cursor: "grabbing" }, userSelect: "none" }}
        actions={
          <Box
            sx={{ justifySelf: "end", display: "flex", gap: 0.25 }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {!hideDock && (
              <Tooltip title="Dock in the sidebar">
                <IconButton
                  size="small"
                  onClick={onPopIn}
                  sx={{ color: "text.secondary", p: "7px" }}
                >
                  <PopInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Close window">
              <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary", p: "7px" }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      <FigureFrame
        view={view}
        presentTissues={presentTissues}
        selectedTissue={selectedTissue}
        tpmByTissue={tpmByTissue}
        domainMax={domainMax}
        onPick={onPickTissue}
        fit="contain"
      />

      <AnatomogramAttribution />

      <ResizeHandles onResize={startResize} />
    </Paper>
  )
}
