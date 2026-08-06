// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, type ReactNode } from "react"
import { Box } from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"
import AnatomogramViewToggles from "./ViewToggles"
import type { RailView } from "./tissueMaps"

interface Props {
  view: RailView
  onPickSex: (sex: "female" | "male") => void
  onPickBrain: () => void
  actions: ReactNode
  /** Drag props when the header doubles as a floating window's grab area */
  dragProps?: {
    onMouseDown?: (e: React.MouseEvent) => void
    onTouchStart?: (e: React.TouchEvent) => void
    onDoubleClick?: (e: React.MouseEvent) => void
  }
  sx?: SxProps<Theme>
}

const AnatomogramHeader = forwardRef<HTMLDivElement, Props>(function AnatomogramHeader(
  { view, onPickSex, onPickBrain, actions, dragProps, sx },
  ref,
) {
  return (
    <Box
      ref={ref}
      {...dragProps}
      sx={[
        {
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box />
      <Box sx={{ justifySelf: "center" }} onDoubleClick={(e) => e.stopPropagation()}>
        <AnatomogramViewToggles view={view} onPickSex={onPickSex} onPickBrain={onPickBrain} />
      </Box>
      {actions}
    </Box>
  )
})

export default AnatomogramHeader
