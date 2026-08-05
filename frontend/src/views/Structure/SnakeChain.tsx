// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { confidenceColor } from "./confidenceColor"
import { DIM_OPACITY, SNAKE, TRACK } from "./constants"
import type { Bead, SnakeElement } from "./snakeLayout"

export interface SnakeInk {
  chain: string
  chainLit: string
  edge: string
  neutralFill: string
  neutralInk: string
  label: string
  lit: string
  letterInk: Record<string, string>
  ligand: (index: number) => string
}

interface Props {
  element: SnakeElement
  labelY: number
  ink: SnakeInk
  lit: boolean
  dim: boolean
  pointed: number | null
}

const SnakeChain = memo(function SnakeChain({ element, labelY, ink, lit, dim, pointed }: Props) {
  const dash = element.unresolved ? TRACK.unresolvedDash : undefined
  const ringFor = (bead: Bead) => {
    if (bead.residue === pointed) return { stroke: ink.lit, width: SNAKE.litRing, dash }
    if (bead.ligandIndex !== null) {
      return { stroke: ink.ligand(bead.ligandIndex), width: SNAKE.siteRing, dash }
    }
    return element.unresolved
      ? { stroke: ink.chain, width: SNAKE.chainWidth, dash }
      : { stroke: ink.edge, width: SNAKE.beadStroke, dash }
  }

  return (
    <g opacity={dim && !lit ? DIM_OPACITY : 1}>
      <path
        d={element.chain}
        fill="none"
        stroke={lit ? ink.chainLit : ink.chain}
        strokeWidth={SNAKE.chainWidth}
        strokeLinecap="round"
      />

      {element.label && (
        <text
          x={element.labelX}
          y={labelY}
          fontSize={SNAKE.segmentLabelSize}
          fontWeight={600}
          textAnchor={element.labelAnchor}
          dominantBaseline="central"
          fill={ink.label}
        >
          {element.label}
        </text>
      )}

      {element.beads.map((bead) => {
        const fill = bead.score === null ? ink.neutralFill : confidenceColor(bead.score)
        const ring = ringFor(bead)
        return (
          <circle
            key={bead.residue}
            data-residue={bead.residue}
            cx={bead.x}
            cy={bead.y}
            r={SNAKE.bead}
            fill={fill}
            stroke={ring.stroke}
            strokeWidth={ring.width}
            strokeDasharray={ring.dash}
            style={{ cursor: "pointer" }}
          />
        )
      })}

      {element.beads.map(
        (bead) =>
          bead.letter && (
            <text
              key={bead.residue}
              x={bead.x}
              y={bead.y}
              fontSize={SNAKE.letterSize}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              fill={
                bead.score === null ? ink.neutralInk : ink.letterInk[confidenceColor(bead.score)]
              }
              style={{ pointerEvents: "none" }}
            >
              {bead.letter}
            </text>
          ),
      )}
    </g>
  )
})

export default SnakeChain
