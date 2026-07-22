// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, RefObject } from "react"
import { Box } from "@mui/material"
import type { TbState } from "./useToolbarFit"

interface Props {
  toolbarRef: RefObject<HTMLDivElement | null>
  tbState: TbState
  toggles: ReactNode
  actions: ReactNode
}

export default function ViewToolbar({ toolbarRef, tbState, toggles, actions }: Props) {
  const wrapped = tbState === "wrapped"
  return (
    <Box
      ref={toolbarRef}
      sx={{
        display: "flex",
        px: 2,
        py: 2,
        gap: 1.5,
        flexWrap: "wrap",
        alignItems: wrapped ? "stretch" : "center",
      }}
    >
      {toggles}
      {!wrapped && <Box sx={{ flexGrow: 1 }} />}
      {actions}
    </Box>
  )
}
