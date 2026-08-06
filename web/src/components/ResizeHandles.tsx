// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { PointerEvent as ReactPointerEvent } from "react"
import { Box } from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"
import type { ResizeDirs } from "@/utils/useResizablePanel"

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

interface ResizeHandlesProps {
  onResize: (e: ReactPointerEvent, dirs: ResizeDirs) => void
}

export default function ResizeHandles({ onResize }: ResizeHandlesProps) {
  return (
    <>
      {HANDLES.map((hnd) => (
        <Box
          key={hnd.id}
          onPointerDown={(e) => onResize(e, hnd.dirs)}
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
    </>
  )
}
