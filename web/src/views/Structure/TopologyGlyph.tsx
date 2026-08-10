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
  mark: string
  paper: string
}

interface Props {
  gene: WallGene
  ink: WallInk
  membrane: boolean
}

const MID = WALL.bandTop + WALL.bandHeight / 2

const TopologyGlyph = memo(function TopologyGlyph({ gene, ink, membrane }: Props) {
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

      {membrane ? (
        <>
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
        </>
      ) : (
        <>
          <rect
            x={0}
            y={WALL.railTop}
            width={WALL.glyphWidth}
            height={WALL.railHeight}
            rx={WALL.pillRadius}
            fill={ink.band}
          />
          {gene.features.map((feature, index) => {
            const key = [feature.kind, feature.start, feature.end, index].join("-")
            if (feature.kind === "signal_peptide") {
              return (
                <rect
                  key={key}
                  x={feature.start * scale}
                  y={WALL.railTop}
                  width={Math.max((feature.end - feature.start + 1) * scale, WALL.minPillWidth)}
                  height={WALL.railHeight}
                  rx={WALL.pillRadius}
                  fill={gene.color}
                />
              )
            }
            const binds = feature.kind === "binding_site" || feature.kind === "active_site"
            return (
              <circle
                key={key}
                cx={feature.start * scale}
                cy={WALL.railTop - WALL.markGap}
                r={WALL.markRadius}
                fill={binds ? gene.color : feature.kind === "glycosylation" ? ink.mark : ink.paper}
                stroke={binds ? gene.color : ink.mark}
                strokeWidth={1}
              />
            )
          })}
        </>
      )}
    </svg>
  )
})

export default TopologyGlyph
