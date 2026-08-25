// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import type { AxisScale } from "@/api/hooks/useClustering"
import { sansFontFamily } from "@/theme/fonts"
import type { TreeLayout } from "./phyloLayout"

export const AXIS_H = 46

const LABEL_BASELINE = 16
const TICK_STEP = 0.1

function axisTicks(maxVal: number): number[] {
  if (maxVal <= 0) return [0]
  const count = Math.floor(maxVal / TICK_STEP)
  const ticks = Array.from({ length: count + 1 }, (_, i) => Math.round(i * TICK_STEP * 1e10) / 1e10)
  const lastRound = ticks[ticks.length - 1]
  if (maxVal - lastRound > TICK_STEP * 0.01) {
    if (ticks.length > 1 && maxVal - lastRound < TICK_STEP * 0.75) ticks.pop()
    ticks.push(maxVal)
  }
  return ticks
}

const formatTick = (v: number, percent: boolean) =>
  percent ? `${Math.round(v * 100)}%` : parseFloat(v.toFixed(2)).toString()

interface Props {
  layoutData: TreeLayout
  scale: number
  color: string
  monoFont: string
  compact: boolean
  axisScale: AxisScale
}

export default function PhyloAxis({ layoutData, scale, color, monoFont, compact, axisScale }: Props) {
  const { treeLeft, treeRight, maxDepth, width } = layoutData
  const { label, percent } = axisScale
  return (
    <Box sx={{ position: "sticky", top: 0, zIndex: 1, bgcolor: "background.paper", pb: 1.5 }}>
      <svg
        width={width * scale}
        height={AXIS_H}
        viewBox={`0 0 ${width} ${AXIS_H}`}
        style={{ display: "block", margin: "0 auto" }}
      >
        {label && (
          <text
            x={(treeLeft + treeRight) / 2}
            y={LABEL_BASELINE}
            textAnchor="middle"
            fontSize={compact ? 10 : 11}
            fontFamily={sansFontFamily}
            fill={color}
          >
            {label}
          </text>
        )}
        <line
          x1={treeLeft}
          y1={AXIS_H - 1}
          x2={treeRight}
          y2={AXIS_H - 1}
          stroke={color}
          strokeWidth={0.5}
        />
        {axisTicks(maxDepth).map((t) => {
          const x = treeRight - (t / maxDepth) * (treeRight - treeLeft)
          const fontSize = compact ? 9 : 11
          const text = formatTick(t, percent)
          const half = (text.length * fontSize * 0.6) / 2
          const labelX = Math.min(width - half, Math.max(half, x))
          return (
            <g key={t}>
              <line
                x1={x}
                y1={AXIS_H - 1}
                x2={x}
                y2={AXIS_H - 7}
                stroke={color}
                strokeWidth={0.5}
              />
              <text
                x={labelX}
                y={AXIS_H - 10}
                textAnchor="middle"
                fontSize={fontSize}
                fontFamily={monoFont}
                fill={color}
              >
                {text}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
