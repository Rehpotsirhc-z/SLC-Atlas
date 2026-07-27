// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography, useTheme } from "@mui/material"

export interface Swatch {
  key: string
  color: string
  label: string
  // Trailing detail rendered dimmer than the label, e.g. a count or a range
  detail?: string
}

interface Props {
  title?: string
  swatches: Swatch[]
}

// Discrete categories, where HeatmapColorLegend covers continuous ones
export default function SwatchLegend({ title, swatches }: Props) {
  const theme = useTheme()
  const labelSx = {
    fontFamily: theme.custom.monoFontFamily,
    fontSize: 10,
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
  }

  if (swatches.length === 0) return null

  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, rowGap: 0.75 }}>
      {title && (
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mr: 0.5 }}>
          {title}
        </Typography>
      )}
      {swatches.map((swatch) => (
        <Box key={swatch.key} sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 1 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: 0.5,
              border: 1,
              borderColor: "divider",
              bgcolor: swatch.color,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ ...labelSx, color: "text.primary" }}>{swatch.label}</Typography>
          {swatch.detail && (
            <Typography sx={{ ...labelSx, color: "text.secondary" }}>{swatch.detail}</Typography>
          )}
        </Box>
      ))}
    </Box>
  )
}
