// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, useTheme } from "@mui/material"

interface MiniBarProps {
  fraction: number
  color?: string
  width?: number | string
}

export default function MiniBar({ fraction, color, width = "100%" }: MiniBarProps) {
  const theme = useTheme()
  const fill = color ?? theme.palette.primary.main
  const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))
  return (
    <Box
      sx={{
        width,
        minWidth: 0,
        height: 7,
        borderRadius: 1,
        bgcolor: theme.palette.action.hover,
        overflow: "hidden",
      }}
    >
      <Box sx={{ width: `${clamped * 100}%`, height: "100%", borderRadius: 1, bgcolor: fill }} />
    </Box>
  )
}
