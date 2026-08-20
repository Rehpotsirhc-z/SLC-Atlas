// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, TableCell, Typography, useTheme } from "@mui/material"
import type { Transcript } from "@/types/gene"
import { biotypeColor } from "@/utils/biotypeColor"
import { MAP_COLUMN_MIN_WIDTH } from "./constants"
import {
  formatMb,
  GRID_COLOR,
  TEXT_COLOR,
  TICK_FRACTIONS,
  type TranscriptScale,
} from "./transcriptMap"

const BAR_H = 10
const AXIS_H = 20
const TICK_H = 6

const GUTTER_L = 32
const PAD_R = 24

const trackSpan = `(100% - ${GUTTER_L + PAD_R}px)`
const trackLeft = (f: number) => `calc(${GUTTER_L}px + ${f} * ${trackSpan})`
const trackWidth = (f: number) => `calc(${f} * ${trackSpan})`

export function MapAxisHeader({ scale }: { scale: TranscriptScale }) {
  const { custom, palette } = useTheme()
  const textColor = TEXT_COLOR[palette.mode]
  return (
    <TableCell
      sx={{
        position: "relative",
        p: 0,
        verticalAlign: "bottom",
        width: "100%",
        minWidth: MAP_COLUMN_MIN_WIDTH,
      }}
    >
      <Box sx={{ position: "relative", height: AXIS_H }}>
        {TICK_FRACTIONS.map((f) => (
          <Box
            key={f}
            component="span"
            sx={{
              position: "absolute",
              bottom: 0,
              height: TICK_H,
              left: trackLeft(f),
              borderLeft: `1px solid ${GRID_COLOR[palette.mode]}`,
            }}
          />
        ))}
        {TICK_FRACTIONS.map((f) => (
          <Typography
            key={f}
            component="span"
            sx={{
              position: "absolute",
              top: 0,
              left: trackLeft(f),
              transform: "translateX(-50%)",
              fontFamily: custom.monoFontFamily,
              fontSize: 9,
              color: textColor,
              whiteSpace: "nowrap",
            }}
          >
            {formatMb(scale.minStart + f * scale.span)}
          </Typography>
        ))}
      </Box>
    </TableCell>
  )
}

export function MapBarCell({
  transcript,
  scale,
}: {
  transcript: Transcript
  scale: TranscriptScale
}) {
  const { palette } = useTheme()
  const color = biotypeColor(transcript.type, palette.mode)
  const startF = scale.fraction(transcript.start)
  const endF = scale.fraction(transcript.end)
  return (
    <TableCell sx={{ position: "relative", p: 0 }}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: trackLeft(startF),
          width: trackWidth(endF - startF),
          minWidth: 2,
          height: BAR_H,
          borderRadius: "2px",
          bgcolor: color,
          opacity: 0.8,
        }}
      />
    </TableCell>
  )
}
