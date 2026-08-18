// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import { Box, Tooltip, Typography, useTheme } from "@mui/material"
import { AXIS_W, EDGE_PAD } from "./constants"

interface Props {
  gutter: number
  height: number
  name: string
  group?: string
  title?: string
  dimmed?: boolean
  children?: ReactNode
  details?: ReactNode
}

export default function LaneGutter({
  gutter,
  height,
  name,
  group,
  title,
  dimmed,
  children,
  details,
}: Props) {
  const { custom } = useTheme()
  return (
    <Box
      sx={{
        width: gutter - AXIS_W,
        height,
        flexShrink: 0,
        pl: `${EDGE_PAD}px`,
        pr: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        userSelect: "text",
        cursor: "text",
      }}
    >
      {group !== undefined && (
        <Typography
          noWrap
          sx={{
            fontSize: 11,
            lineHeight: 1.4,
            textTransform: "uppercase",
            letterSpacing: 0.7,
            color: "primary.main",
          }}
        >
          {group}
        </Typography>
      )}
      <Tooltip title={title ?? name}>
        <Typography
          noWrap
          sx={{ fontSize: 13, lineHeight: 1.3, color: dimmed ? "text.disabled" : "text.primary" }}
        >
          {name}
        </Typography>
      </Tooltip>
      {children !== undefined && (
        <Typography
          component="span"
          noWrap
          sx={{
            fontSize: 11.5,
            lineHeight: 1.4,
            fontFamily: custom.monoFontFamily,
            color: "text.secondary",
          }}
        >
          {children}
        </Typography>
      )}
      {details !== undefined && (
        <Box
          sx={{
            fontSize: 11.5,
            lineHeight: 1.4,
            fontFamily: custom.monoFontFamily,
            color: "text.secondary",
          }}
        >
          {details}
        </Box>
      )}
    </Box>
  )
}
