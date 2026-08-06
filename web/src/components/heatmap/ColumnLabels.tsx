// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"

export interface ColumnLabelItem {
  key: string
  text: string
}

interface ColumnLabelStyle {
  cellW: number
  y: number
  font: number
  fontFamily: string
  fill: string
  fontWeight?: number
}

export function ColumnLabel({
  text,
  index,
  cellW,
  y,
  font,
  fontFamily,
  fill,
  fontWeight,
}: ColumnLabelStyle & { text: string; index: number }) {
  const x = index * cellW + cellW / 2
  return (
    <text
      x={x}
      y={y}
      fontSize={font}
      fontFamily={fontFamily}
      fill={fill}
      fontWeight={fontWeight}
      textAnchor="start"
      dominantBaseline="central"
      transform={`rotate(90 ${x} ${y})`}
      style={{ pointerEvents: "none" }}
    >
      {text}
    </text>
  )
}

// Memoised because a header re-render on hover would otherwise rebuild every label
const ColumnLabels = memo(function ColumnLabels({
  labels,
  ...style
}: ColumnLabelStyle & { labels: ColumnLabelItem[] }) {
  return (
    <>
      {labels.map((label, i) => (
        <ColumnLabel key={label.key} text={label.text} index={i} {...style} />
      ))}
    </>
  )
})

export default ColumnLabels
