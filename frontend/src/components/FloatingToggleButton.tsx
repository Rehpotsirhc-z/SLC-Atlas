// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import CloseIcon from "@mui/icons-material/Close"
import { IconButton, Tooltip, useTheme } from "@mui/material"
import { alpha, emphasize, type SxProps, type Theme } from "@mui/material/styles"

export const floatSurfaceBg = (theme: Theme) => alpha(theme.palette.background.paper, 0.9)

const floatSurfaceBgHover = (theme: Theme) =>
  alpha(emphasize(theme.palette.background.paper, 0.06), 0.9)

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
            backdropFilter: "blur(10px)",
            bgcolor: floatSurfaceBg(theme),
            border: 1,
            borderColor: "divider",
            color: open ? "text.secondary" : "primary.main",
            "&:hover": { bgcolor: floatSurfaceBgHover(theme) },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {open ? <CloseIcon fontSize="small" /> : icon}
      </IconButton>
    </Tooltip>
  )
}
