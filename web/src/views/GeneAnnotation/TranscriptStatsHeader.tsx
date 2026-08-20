// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Fragment } from "react"
import { Box, Chip, Typography, useTheme } from "@mui/material"
import { biotypeColor } from "@/utils/biotypeColor"
import type { TranscriptStats } from "./transcriptStats"

interface Props {
  typeCounts: [string, number][]
  stats: TranscriptStats
}

export default function TranscriptStatsHeader({ typeCounts, stats }: Props) {
  const { custom, palette } = useTheme()
  const monoSx = { fontFamily: custom.monoFontFamily, fontSize: custom.monoFontSize }

  const statRows: [string, string][] = [
    ["Total", `${stats.total} transcript${stats.total !== 1 ? "s" : ""}`],
    ["Genomic span", `${(stats.span / 1000).toFixed(1)} kb`],
    ["Length range", `${stats.minLength.toLocaleString()}–${stats.maxLength.toLocaleString()} bp`],
    ["Longest", stats.longestName || stats.longestId],
  ]

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 6, rowGap: 2 }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Typography variant="overline" color="primary" sx={{ lineHeight: 1, mb: 0.5 }}>
          Biotypes
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: 1,
            rowGap: 0.75,
            alignItems: "center",
          }}
        >
          {typeCounts.map(([type, count]) => {
            const color = biotypeColor(type, palette.mode)
            return (
              <Fragment key={type}>
                <Chip
                  label={count}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.7rem",
                    minWidth: 24,
                    bgcolor: "action.selected",
                    border: `2px solid ${color}`,
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {type.replace(/_/g, " ")}
                </Typography>
              </Fragment>
            )
          })}
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Typography variant="overline" color="primary" sx={{ lineHeight: 1, mb: 0.5 }}>
          Stats
        </Typography>
        {statRows.map(([label, value]) => (
          <Box key={label} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>
              {label}
            </Typography>
            <Typography variant="caption" sx={monoSx}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
