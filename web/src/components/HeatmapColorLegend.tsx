// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography, useTheme } from "@mui/material"

export interface LegendTick {
  frac: number // 0 = bottom of the bar (low), 1 = top (high)
  label: string
}

interface HeatmapColorLegendProps {
  title: string
  colorAt: (t: number) => string // t in [0,1]
  ticks: LegendTick[]
  absent?: { color: string; label: string }
  height?: number
}

const STOPS = 16
const BAR_W = 12

export default function HeatmapColorLegend({
  title,
  colorAt,
  ticks,
  absent,
  height = 190,
}: HeatmapColorLegendProps) {
  const theme = useTheme()
  const mono = theme.custom.monoFontFamily
  const gradient = `linear-gradient(to top, ${Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1)
    return `${colorAt(t)} ${(t * 100).toFixed(1)}%`
  }).join(", ")})`

  const tickSx = {
    fontFamily: mono,
    fontSize: 10,
    lineHeight: 1,
    color: "text.secondary",
    whiteSpace: "nowrap" as const,
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        py: 1.5,
        userSelect: "none",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ alignSelf: "stretch", fontWeight: 600, lineHeight: 1.1, textAlign: "center" }}
      >
        {title}
      </Typography>
      <Box sx={{ position: "relative", width: BAR_W, height }}>
        <Box
          sx={{
            width: BAR_W,
            height,
            borderRadius: 0.5,
            border: 1,
            borderColor: "divider",
            background: gradient,
          }}
        />
        {ticks.map((tk) => (
          <Typography
            key={tk.frac}
            sx={{
              ...tickSx,
              position: "absolute",
              top: `${(1 - tk.frac) * 100}%`,
              left: "calc(100% + 5px)",
              transform: `translateY(${-(1 - tk.frac) * 100}%)`,
            }}
          >
            {tk.label}
          </Typography>
        ))}
      </Box>
      {absent && (
        <Box
          sx={{
            alignSelf: "stretch",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 0.5,
              border: 1,
              borderColor: "divider",
              bgcolor: "divider",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <Box sx={{ position: "absolute", inset: 0, bgcolor: absent.color }} />
          </Box>
          <Typography sx={tickSx}>{absent.label}</Typography>
        </Box>
      )}
    </Box>
  )
}
