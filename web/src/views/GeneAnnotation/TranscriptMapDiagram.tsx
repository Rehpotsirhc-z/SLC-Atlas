// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography, useTheme } from "@mui/material"
import type { Transcript } from "@/types/gene"
import { biotypeColor } from "@/utils/biotypeColor"
import { useElementSize } from "@/utils/useElementSize"

const ROW_H = 22
const BAR_H = 10
const LABEL_W = 95
const TICK_AREA_H = 20

const TEXT_COLOR = { dark: "#9ca0a4", light: "#5B6268" }
const GRID_COLOR = { dark: "#3f444a", light: "#c6c7c7" }

const TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1]

interface Props {
  transcripts: Transcript[]
}

export default function TranscriptMapDiagram({ transcripts }: Props) {
  const { custom, palette } = useTheme()
  const [containerRef, { w: width }] = useElementSize<HTMLDivElement>()

  const minStart = Math.min(...transcripts.map((t) => t.start))
  const maxEnd = Math.max(...transcripts.map((t) => t.end))
  const span = maxEnd - minStart || 1
  const trackW = Math.max(0, width - LABEL_W)
  const barsH = transcripts.length * ROW_H
  const svgH = barsH + TICK_AREA_H

  const textColor = TEXT_COLOR[palette.mode]
  const gridColor = GRID_COLOR[palette.mode]
  const toX = (pos: number) => LABEL_W + ((pos - minStart) / span) * trackW

  const ticks = TICK_FRACTIONS.map((f) => ({
    x: LABEL_W + f * trackW,
    label: `${((minStart + f * span) / 1_000_000).toFixed(2)} Mb`,
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
            {ticks.map(({ x, f }) => (
              <line
                key={f}
                x1={x}
                y1={0}
                x2={x}
                y2={barsH}
                stroke={gridColor}
                strokeWidth={1}
                strokeDasharray={f === 0 || f === 1 ? undefined : "4 4"}
              />
            ))}
            {transcripts.map((t, i) => {
              const barColor = biotypeColor(t.type, palette.mode)
              const x1 = toX(t.start)
              const x2 = toX(t.end)
              const midY = i * ROW_H + ROW_H / 2
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
                  <line
                    x1={x1}
                    y1={midY}
                    x2={x2}
                    y2={midY}
                    stroke={barColor}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                  <rect
                    x={x1}
                    y={midY - BAR_H / 2}
                    width={Math.max(1, x2 - x1)}
                    height={BAR_H}
                    rx={2}
                    fill={barColor}
                    fillOpacity={0.75}
                  />
                </g>
              )
            })}
            {ticks.map(({ x, label, f }) => (
              <text
                key={f}
                x={x}
                y={barsH + 14}
                textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                fontSize={9}
                fontFamily={custom.monoFontFamily}
                fill={textColor}
              >
                {label}
              </text>
            ))}
          </svg>
        )}
      </Box>
    </Box>
  )
}
