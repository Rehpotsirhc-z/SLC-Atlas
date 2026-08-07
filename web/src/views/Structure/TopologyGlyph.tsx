// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { WALL } from "./constants"
import type { WallGene } from "./topologyWall"

export interface WallInk {
  band: string
  chain: string
  label: string
}

interface Props {
  gene: WallGene
  ink: WallInk
}

const MID = WALL.bandTop + WALL.bandHeight / 2

const TopologyGlyph = memo(function TopologyGlyph({ gene, ink }: Props) {
  const scale = WALL.glyphWidth / Math.max(gene.length, 1)
  return (
    <svg
      width={WALL.glyphWidth}
      height={WALL.glyphHeight}
      viewBox={`0 0 ${WALL.glyphWidth} ${WALL.glyphHeight}`}
      style={{ display: "block" }}
    >
      <text
        x={0}
        y={WALL.labelBaseline}
        fill={ink.label}
        fontSize={WALL.labelSize}
        fontFamily="inherit"
      >
        {gene.symbol}
      </text>
      {gene.bestPdbId && (
        <text
          x={WALL.glyphWidth}
          y={WALL.labelBaseline}
          textAnchor="end"
          fill={gene.color}
          fontSize={WALL.pdbSize}
          fontFamily="inherit"
        >
          {gene.bestPdbId.toUpperCase()}
        </text>
      )}
      <rect
        x={0}
        y={WALL.bandTop}
        width={WALL.glyphWidth}
        height={WALL.bandHeight}
        rx={WALL.pillRadius}
        fill={ink.band}
      />
      <line x1={0} y1={MID} x2={WALL.glyphWidth} y2={MID} stroke={ink.chain} strokeWidth={1} />
      {gene.segments.map((segment) => (
        <rect
          key={`${segment.start}-${segment.end}`}
          x={segment.start * scale}
          y={WALL.bandTop}
          width={Math.max((segment.end - segment.start + 1) * scale, WALL.minPillWidth)}
          height={WALL.bandHeight}
          rx={WALL.pillRadius}
          fill={gene.color}
          opacity={segment.kind === "intramembrane" ? WALL.intramembraneOpacity : undefined}
        />
      ))}
    </svg>
  )
})

export default TopologyGlyph
