// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography, useTheme } from "@mui/material"
import type { Transcript } from "@/types/gene"
import { biotypeColor } from "@/utils/biotypeColor"
import { useElementSize } from "@/utils/useElementSize"
import { formatMb, GRID_COLOR, TEXT_COLOR, TICK_FRACTIONS } from "./transcriptMap"

const ROW_H = 22
const BAR_H = 10
const LABEL_W = 95
const AXIS_H = 20
const TICK_H = 6
const PAD_R = 24

interface Props {
  transcripts: Transcript[]
}

export default function TranscriptMapDiagram({ transcripts }: Props) {
  const { custom, palette } = useTheme()
  const [containerRef, { w: width }] = useElementSize<HTMLDivElement>()

  const minStart = Math.min(...transcripts.map((t) => t.start))
  const maxEnd = Math.max(...transcripts.map((t) => t.end))
  const span = maxEnd - minStart || 1
  const trackW = Math.max(0, width - LABEL_W - PAD_R)
  const barsH = transcripts.length * ROW_H
  const svgH = AXIS_H + barsH

  const textColor = TEXT_COLOR[palette.mode]
  const gridColor = GRID_COLOR[palette.mode]
  const toX = (pos: number) => LABEL_W + ((pos - minStart) / span) * trackW

  const ticks = TICK_FRACTIONS.map((f) => ({
    x: LABEL_W + f * trackW,
    label: formatMb(minStart + f * span),
    f,
  }))

  return (
    <Box>
      <Typography
        variant="overline"
        color="primary"
        sx={{ lineHeight: 1, mb: 1, display: "block" }}
      >
        Transcript Map
      </Typography>
      <Box ref={containerRef} sx={{ width: "100%" }}>
        {width > 0 && (
          <svg width={width} height={svgH} style={{ display: "block" }}>
            {ticks.map(({ x, label, f }) => (
              <g key={f}>
                <text
                  x={x}
                  y={9}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily={custom.monoFontFamily}
                  fill={textColor}
                >
                  {label}
                </text>
                <line
                  x1={x}
                  y1={AXIS_H - TICK_H}
                  x2={x}
                  y2={AXIS_H}
                  stroke={gridColor}
                  strokeWidth={1}
                />
              </g>
            ))}
            {transcripts.map((t, i) => {
              const barColor = biotypeColor(t.type, palette.mode)
              const x1 = toX(t.start)
              const x2 = toX(t.end)
              const midY = AXIS_H + i * ROW_H + ROW_H / 2
              return (
                <g key={t.id}>
                  <text
                    x={0}
                    y={midY + 4}
                    textAnchor="start"
                    fontSize={10}
                    fontFamily={custom.monoFontFamily}
                    fill={textColor}
                  >
                    {t.name || t.id}
                  </text>
                  <rect
                    x={x1}
                    y={midY - BAR_H / 2}
                    width={Math.max(1, x2 - x1)}
                    height={BAR_H}
                    rx={2}
                    fill={barColor}
                    fillOpacity={0.8}
                  />
                </g>
              )
            })}
          </svg>
        )}
      </Box>
    </Box>
  )
}
