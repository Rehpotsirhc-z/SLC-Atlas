// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { SNAKE, TRACK } from "./constants"
import { beadFill, beadLetterInk, type SnakeInk } from "./snakeInk"
import type { Bead } from "./snakeLayout"

interface Props {
  bead: Bead
  unresolved: boolean
  ink: SnakeInk
}

const SnakeBead = memo(function SnakeBead({ bead, unresolved, ink }: Props) {
  return (
    <g>
      <circle
        cx={bead.x}
        cy={bead.y}
        r={SNAKE.bead}
        fill={beadFill(bead, ink)}
        stroke={ink.lit}
        strokeWidth={SNAKE.litRing}
        strokeDasharray={unresolved ? TRACK.unresolvedDash : undefined}
      />
      {bead.letter && (
        <text
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
      )}
    </g>
  )
})

export default SnakeBead
