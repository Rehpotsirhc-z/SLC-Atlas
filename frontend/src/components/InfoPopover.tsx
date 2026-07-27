// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState, type ReactNode } from "react"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { Box, IconButton, Popover } from "@mui/material"

interface Props {
  label: string
  children: ReactNode
}

// Keeps "how to read this" prose off the page until asked for
export default function InfoPopover({ label, children }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "text.secondary" } }}
      >
        <HelpOutlineIcon sx={{ fontSize: 15 }} />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { variant: "outlined", sx: { maxWidth: 380 } } }}
      >
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>{children}</Box>
      </Popover>
    </>
  )
}
