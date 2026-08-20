// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import CloseIcon from "@mui/icons-material/Close"
import { IconButton, Tooltip, useTheme } from "@mui/material"
import { emphasize, type SxProps, type Theme } from "@mui/material/styles"

type Props = {
  open: boolean
  onToggle: () => void
  icon: ReactNode
  title: string
  openTitle: string
  sx?: SxProps<Theme>
}

export default function FloatingToggleButton({
  open,
  onToggle,
  icon,
  title,
  openTitle,
  sx,
}: Props) {
  const theme = useTheme()
  const label = open ? openTitle : title

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={onToggle}
        sx={[
          {
            position: "absolute",
            width: 44,
            height: 44,
            borderRadius: "50%",
            boxShadow: 4,
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            color: open ? "text.secondary" : "primary.main",
            "&:hover": { bgcolor: emphasize(theme.palette.background.paper, 0.06) },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {open ? <CloseIcon fontSize="small" /> : icon}
      </IconButton>
    </Tooltip>
  )
}
