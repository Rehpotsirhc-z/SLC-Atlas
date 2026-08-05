// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { RESIDUES, TRACK } from "./constants"
import { beadFill, beadLetterInk, type BeadInk } from "./beadInk"
import type { Bead } from "./residuesLayout"

interface Props {
  bead: Bead
  unresolved: boolean
  ink: BeadInk
}

const LitBead = memo(function LitBead({ bead, unresolved, ink }: Props) {
  return (
    <g>
      <circle
        cx={bead.x}
        cy={bead.y}
        r={RESIDUES.bead}
        fill={beadFill(bead, ink)}
        stroke={ink.lit}
        strokeWidth={RESIDUES.litRing}
        strokeDasharray={unresolved ? TRACK.unresolvedDash : undefined}
      />
      {bead.letter && (
        <text
          x={bead.x}
          y={bead.y}
          fontSize={RESIDUES.letterSize}
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

export default LitBead
