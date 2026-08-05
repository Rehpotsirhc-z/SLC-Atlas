// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { SNAKE, TRACK } from "./constants"
import { beadFill, beadLetterInk, type SnakeInk } from "./snakeInk"
import type { Bead, SnakeElement } from "./snakeLayout"

interface Props {
  element: SnakeElement
  labelY: number
  ink: SnakeInk
}

const SnakeChain = memo(function SnakeChain({ element, labelY, ink }: Props) {
  const dash = element.unresolved ? TRACK.unresolvedDash : undefined
  const ringFor = (bead: Bead) => {
    if (bead.ligandIndex !== null) {
      return { stroke: ink.ligand(bead.ligandIndex), width: SNAKE.siteRing, dash }
    }
    return element.unresolved
      ? { stroke: ink.chain, width: SNAKE.chainWidth, dash }
      : { stroke: ink.edge, width: SNAKE.beadStroke, dash }
  }

  return (
    <g>
      <path
        d={element.chain}
        fill="none"
        stroke={ink.chain}
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
        const ring = ringFor(bead)
        return (
          <circle
            key={bead.residue}
            cx={bead.x}
            cy={bead.y}
            r={SNAKE.bead}
            fill={beadFill(bead, ink)}
            stroke={ring.stroke}
            strokeWidth={ring.width}
            strokeDasharray={ring.dash}
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
              fill={beadLetterInk(bead, ink)}
            >
              {bead.letter}
            </text>
          ),
      )}
    </g>
  )
})

export default SnakeChain
