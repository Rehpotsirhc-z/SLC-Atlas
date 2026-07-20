// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react"
import { Box, IconButton, Paper, Tooltip } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import ResizeHandles from "@/components/ResizeHandles"
import { useUIStore } from "@/store/uiStore"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { useResizablePanel } from "@/utils/useResizablePanel"
import { AnatomogramFigure, AnatomogramViewToggles, SVG_FOR, type RailView } from "./index"
import { PopInIcon } from "./icons"
import AnatomogramAttribution from "./Attribution"

const DEFAULT_POS: PanelPos = { x: 64, y: 96 }
const MIN_W = 260
const MIN_H = 280

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
  hideDock?: boolean
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
  hideDock = false,
}: AnatomogramWindowProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const size = useUIStore((s) => s.railFloatSize)
  const pos = useUIStore((s) => s.railFloatPos)
  const setPos = useUIStore((s) => s.setRailFloatPos)
  const setSize = useUIStore((s) => s.setRailFloatSize)

  const { currentPos, handleDragStart, handleTouchStart } = useDraggablePanel(
    panelRef,
    pos,
    setPos,
    DEFAULT_POS,
  )
  const { startResize } = useResizablePanel(currentPos, setPos, size, setSize, MIN_W, MIN_H)

  // The stored size is shared with the desktop pop-out and persisted, so it can
  // exceed a smaller viewport (a narrower screen, or a phone). Clamp what we
  // render to the viewport without mutating the stored preference.
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  const width = Math.min(size.w, vp.w - 24)
  const height = Math.min(size.h, vp.h - 24)

  return (
    <Paper
      ref={panelRef}
      elevation={6}
      sx={{
        position: "fixed",
        top: currentPos.y,
        left: currentPos.x,
        width,
        height,
        zIndex: 6,
        border: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
        onDoubleClick={hideDock ? undefined : onPopIn}
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

      <Box
        onMouseDown={handleDragStart}
        onTouchStart={handleTouchStart}
        onDoubleClick={hideDock ? undefined : onPopIn}
        sx={{
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box />
        <Box sx={{ justifySelf: "center" }} onDoubleClick={(e) => e.stopPropagation()}>
          <AnatomogramViewToggles view={view} onPickSex={onPickSex} onPickBrain={onPickBrain} />
        </Box>
        <Box
          sx={{ justifySelf: "end", display: "flex", gap: 0.25 }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {!hideDock && (
            <Tooltip title="Dock to sidebar" arrow>
              <IconButton size="small" onClick={onPopIn} sx={{ color: "text.secondary", p: "7px" }}>
                <PopInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Close" arrow>
            <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary", p: "7px" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: 1.5,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <AnatomogramFigure
          key={view}
          svg={SVG_FOR[view]}
          view={view}
          presentTissues={presentTissues}
          selectedTissue={selectedTissue}
          tpmByTissue={tpmByTissue}
          domainMax={domainMax}
          onPick={onPickTissue}
          fit="contain"
        />
      </Box>

      <AnatomogramAttribution />

      <ResizeHandles onResize={startResize} />
    </Paper>
  )
}
