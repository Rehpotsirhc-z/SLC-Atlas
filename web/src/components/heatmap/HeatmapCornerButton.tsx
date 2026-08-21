// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState, type ReactNode } from "react"
import TuneIcon from "@mui/icons-material/Tune"
import { Box, IconButton, Popover, Tooltip, useTheme } from "@mui/material"
import { emphasize } from "@mui/material/styles"
import { CORNER_BUTTON_LEFT } from "./constants"

interface HeatmapCornerButtonProps {
  topOffset: number
  children: ReactNode
}

export default function HeatmapCornerButton({ topOffset, children }: HeatmapCornerButtonProps) {
  const theme = useTheme()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const open = Boolean(anchorEl)

  return (
    <Box
      sx={{ position: "absolute", top: topOffset, left: CORNER_BUTTON_LEFT, zIndex: 5 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip title="Display settings">
        <IconButton
          aria-label="Display settings"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            boxShadow: 4,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            color: "text.secondary",
            "&:hover": { bgcolor: emphasize(theme.palette.background.paper, 0.06) },
          }}
        >
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-label": "Display settings",
            elevation: 4,
            sx: {
              mt: 0.5,
              width: 216,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
            },
          },
        }}
      >
        <Box sx={{ pl: 1.5, py: 0.5 }}>{children}</Box>
      </Popover>
    </Box>
  )
}
