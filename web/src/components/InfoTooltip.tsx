// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { Box, Tooltip } from "@mui/material"

interface Props {
  label: string
  children: ReactNode
}

export default function InfoTooltip({ label, children }: Props) {
  return (
    <Tooltip
      title={<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>{children}</Box>}
      placement="bottom-start"
      slotProps={{ tooltip: { sx: { maxWidth: 380 } } }}
    >
      <HelpOutlineIcon
        role="img"
        aria-label={label}
        aria-hidden={false}
        sx={{
          fontSize: 15,
          color: "text.disabled",
          cursor: "help",
          display: "block",
          "&:hover": { color: "text.secondary" },
        }}
      />
    </Tooltip>
  )
}
