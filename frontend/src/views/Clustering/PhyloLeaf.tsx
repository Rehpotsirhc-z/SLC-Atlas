// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { getFamilyColor } from "@/utils/familyColor"
import type { LeafLayout } from "./phyloLayout"

interface LeafLabelProps {
  leaf: LeafLayout
  monoFont: string
  mode: "light" | "dark"
  dimColor: string
  dim: boolean
}

export function LeafLabel({ leaf, monoFont, mode, dimColor, dim }: LeafLabelProps) {
  const color = dim ? dimColor : getFamilyColor(leaf.family ?? "?", mode)

  if (leaf.angle === null) {
    return (
      <g>
        <circle cx={leaf.x} cy={leaf.y} r={4.5} fill={color} />
        <text x={leaf.x + 10} y={leaf.y + 4} fontSize={14} fontFamily={monoFont} fill={color}>
          {leaf.symbol}
        </text>
      </g>
    )
  }

  const deg = (leaf.angle * 180) / Math.PI
  const flip = Math.cos(leaf.angle) < 0
  return (
    <g>
      <circle cx={leaf.x} cy={leaf.y} r={2.2} fill={color} />
      <text
        x={flip ? leaf.x - 5 : leaf.x + 5}
        y={leaf.y}
        dy={2.6}
        fontSize={8}
        fontFamily={monoFont}
        fill={color}
        textAnchor={flip ? "end" : "start"}
        transform={`rotate(${flip ? deg + 180 : deg} ${leaf.x} ${leaf.y})`}
      >
        {leaf.symbol}
      </text>
    </g>
  )
}

export function Highlight({ leaf, color }: { leaf: LeafLayout; color: string }) {
  const r = leaf.angle === null ? 7 : 5
  return <circle cx={leaf.x} cy={leaf.y} r={r} fill="none" stroke={color} strokeWidth={2} />
}
