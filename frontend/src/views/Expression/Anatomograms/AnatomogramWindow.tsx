// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useRef } from "react"
import { Box, IconButton, Paper, Tooltip } from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"
import CloseIcon from "@mui/icons-material/Close"
import { useUIStore } from "@/store/uiStore"
import { useDraggablePanel, type PanelPos } from "@/utils/useDraggablePanel"
import { AnatomogramFigure, AnatomogramViewToggles, SVG_FOR, type RailView } from "./index"
import { PopInIcon } from "./icons"

const DEFAULT_POS: PanelPos = { x: 64, y: 96 }
const MIN_W = 260
const MIN_H = 280

interface ResizeDirs {
  top?: boolean
  bottom?: boolean
  left?: boolean
  right?: boolean
}

// Edge and corner grips
const HANDLES: { id: string; dirs: ResizeDirs; sx: SxProps<Theme> }[] = [
  {
    id: "n",
    dirs: { top: true },
    sx: { top: 0, left: 10, right: 10, height: 6, cursor: "ns-resize" },
  },
  {
    id: "s",
    dirs: { bottom: true },
    sx: { bottom: 0, left: 10, right: 10, height: 6, cursor: "ns-resize" },
  },
  {
    id: "w",
    dirs: { left: true },
    sx: { left: 0, top: 10, bottom: 10, width: 6, cursor: "ew-resize" },
  },
  {
    id: "e",
    dirs: { right: true },
    sx: { right: 0, top: 10, bottom: 10, width: 6, cursor: "ew-resize" },
  },
  {
    id: "nw",
    dirs: { top: true, left: true },
    sx: { top: 0, left: 0, width: 12, height: 12, cursor: "nwse-resize" },
  },
  {
    id: "ne",
    dirs: { top: true, right: true },
    sx: { top: 0, right: 0, width: 12, height: 12, cursor: "nesw-resize" },
  },
  {
    id: "sw",
    dirs: { bottom: true, left: true },
    sx: { bottom: 0, left: 0, width: 12, height: 12, cursor: "nesw-resize" },
  },
  {
    id: "se",
    dirs: { bottom: true, right: true },
    sx: { bottom: 0, right: 0, width: 16, height: 16, cursor: "nwse-resize" },
  },
]

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

  function startResize(e: React.PointerEvent, dirs: ResizeDirs) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const s = { x: currentPos.x, y: currentPos.y, w: size.w, h: size.h }
    const pad = 8
    const onMove = (ev: PointerEvent) => {
      let { x, y, w, h } = s
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (dirs.right) w = Math.max(MIN_W, Math.min(s.w + dx, window.innerWidth - s.x - pad))
      if (dirs.bottom) h = Math.max(MIN_H, Math.min(s.h + dy, window.innerHeight - s.y - pad))
      if (dirs.left) {
        const right = s.x + s.w
        w = Math.max(MIN_W, Math.min(s.w - dx, right - pad))
        x = right - w
      }
      if (dirs.top) {
        const bottom = s.y + s.h
        h = Math.max(MIN_H, Math.min(s.h - dy, bottom - pad))
        y = bottom - h
      }
      setSize({ w, h })
      if (dirs.left || dirs.top) setPos({ x, y })
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <Paper
      ref={panelRef}
      elevation={6}
      sx={{
        position: "fixed",
        top: currentPos.y,
        left: currentPos.x,
        width: size.w,
        height: size.h,
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
        <Box sx={{ justifySelf: "center" }}>
          <AnatomogramViewToggles view={view} onPickSex={onPickSex} onPickBrain={onPickBrain} />
        </Box>
        <Box
          sx={{ justifySelf: "end", display: "flex", gap: 0.25 }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Tooltip title="Dock to sidebar" arrow>
            <IconButton size="small" onClick={onPopIn} sx={{ color: "text.secondary", p: "7px" }}>
              <PopInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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

      {HANDLES.map((hnd) => (
        <Box
          key={hnd.id}
          onPointerDown={(e) => startResize(e, hnd.dirs)}
          sx={{
            position: "absolute",
            zIndex: 1,
            touchAction: "none",
            ...hnd.sx,
            ...(hnd.id === "se" && {
              color: "text.secondary",
              "&::before": {
                content: '""',
                position: "absolute",
                right: 3,
                bottom: 3,
                width: 8,
                height: 8,
                borderRight: "2px solid currentColor",
                borderBottom: "2px solid currentColor",
              },
            }),
          }}
        />
      ))}
    </Paper>
  )
}
