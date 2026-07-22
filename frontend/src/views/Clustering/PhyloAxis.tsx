// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import type { TreeLayout } from "./phyloLayout"

export const AXIS_H = 32

const TICK_STEP = 0.1

function axisTicks(maxVal: number): number[] {
  if (maxVal <= 0) return [0]
  const count = Math.floor(maxVal / TICK_STEP)
  const ticks = Array.from({ length: count + 1 }, (_, i) => Math.round(i * TICK_STEP * 1e10) / 1e10)
  if (Math.abs(ticks[ticks.length - 1] - maxVal) > TICK_STEP * 0.01) ticks.push(maxVal)
  return ticks
}

const formatTick = (v: number) => parseFloat(v.toFixed(2)).toString()

interface Props {
  layoutData: TreeLayout
  scale: number
  color: string
  monoFont: string
  compact: boolean
}

export default function PhyloAxis({ layoutData, scale, color, monoFont, compact }: Props) {
  const { treeLeft, treeRight, maxDepth, width } = layoutData
  return (
    <Box sx={{ position: "sticky", top: 0, zIndex: 1, bgcolor: "background.paper", pb: 1.5 }}>
      <svg
        width={width * scale}
        height={AXIS_H}
        viewBox={`0 0 ${width} ${AXIS_H}`}
        style={{ display: "block", margin: "0 auto" }}
      >
        <line
          x1={treeLeft}
          y1={AXIS_H - 1}
          x2={treeRight}
          y2={AXIS_H - 1}
          stroke={color}
          strokeWidth={0.5}
        />
        {axisTicks(maxDepth).map((t) => {
          const x = treeLeft + (t / maxDepth) * (treeRight - treeLeft)
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
                x={x}
                y={AXIS_H - 10}
                textAnchor="middle"
                fontSize={compact ? 9 : 11}
                fontFamily={monoFont}
                fill={color}
              >
                {formatTick(t)}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
