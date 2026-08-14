// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, Ref } from "react"
import { Paper, useTheme } from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"
import { floatSurfaceBg } from "@/theme"

interface Props {
  sx?: SxProps<Theme>
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

export default function FloatingSurface({ sx, ref, children }: Props) {
  const theme = useTheme()
  return (
    <Paper
      ref={ref}
      elevation={4}
      sx={[
        {
          position: "absolute",
          bgcolor: floatSurfaceBg(theme),
          backdropFilter: "blur(10px)",
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Paper>
  )
}

export const searchSurfaceSx = { p: 1, gap: 0.75, width: 216 } as const
