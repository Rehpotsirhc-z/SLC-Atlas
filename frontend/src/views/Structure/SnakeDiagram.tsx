// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, type RefObject } from "react"
import { alpha, Box, useTheme } from "@mui/material"
import { PLDDT_BANDS } from "./confidenceColor"
import { SNAKE } from "./constants"
import { ligandColorAt } from "./ligandColor"
import SnakeChain, { type SnakeInk } from "./SnakeChain"
import type { SnakeLayout } from "./snakeLayout"
import type { TargetSets, TopologyTarget } from "./topologyTargets"

interface Props {
  layout: SnakeLayout
  highlight: TargetSets
  onHover: (event: React.MouseEvent, target: TopologyTarget) => void
  onLeave: () => void
  onSelect: (target: TopologyTarget) => void
  svgRef?: RefObject<SVGSVGElement | null>
}

const beadResidue = (event: React.MouseEvent): number => {
  const value = Number((event.target as SVGElement).dataset?.residue)
  return value > 0 ? value : 0
}

const SnakeDiagram = memo(function SnakeDiagram({
  layout,
  highlight,
  onHover,
  onLeave,
  onSelect,
  svgRef,
}: Props) {
  const { palette } = useTheme()

  const ink: SnakeInk = useMemo(
    () => ({
      chain: palette.text.secondary,
      chainLit: palette.secondary.main,
      edge: palette.background.default,
      neutralFill: alpha(palette.text.primary, palette.mode === "dark" ? 0.3 : 0.18),
      neutralInk: palette.text.primary,
      label: palette.text.secondary,
      lit: palette.secondary.main,
      letterInk: Object.fromEntries(
        PLDDT_BANDS.map((band) => [band.color, palette.getContrastText(band.color)]),
      ),
      ligand: (index: number) => ligandColorAt(index, palette.mode),
    }),
    [palette],
  )

  const membraneFill = alpha(palette.text.primary, palette.mode === "dark" ? 0.09 : 0.06)
  const membraneEdge = alpha(palette.text.primary, palette.mode === "dark" ? 0.22 : 0.16)

  const targetAt = useCallback(
    (event: React.MouseEvent): TopologyTarget | null => {
      const bead = layout.beadAt.get(beadResidue(event))
      return bead
        ? { kind: "residue", residue: bead.residue, letter: bead.letter, score: bead.score }
        : null
    },
    [layout],
  )

  const onMove = useCallback(
    (event: React.MouseEvent) => {
      const target = targetAt(event)
      if (target) onHover(event, target)
      else onLeave()
    },
    [targetAt, onHover, onLeave],
  )

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      const target = targetAt(event)
      if (target) onSelect(target)
    },
    [targetAt, onSelect],
  )

  const anyLit = highlight.size > 0

  return (
    <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Snake plot: ${layout.length} residues across ${layout.elements.length} stretches of chain`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
      >
        <rect
          x={SNAKE.gutter}
          y={layout.membraneTop}
          width={Math.max(layout.width - SNAKE.gutter, 0)}
          height={layout.membraneBottom - layout.membraneTop}
          fill={membraneFill}
        />
        {[layout.membraneTop, layout.membraneBottom].map((y) => (
          <line key={y} x1={SNAKE.gutter} y1={y} x2={layout.width} y2={y} stroke={membraneEdge} />
        ))}

        {layout.lanes.map((lane) => (
          <text
            key={lane.key}
            x={SNAKE.gutter - 8}
            y={lane.y}
            fontSize={11}
            textAnchor="end"
            dominantBaseline="central"
            fill={ink.label}
          >
            {lane.label}
          </text>
        ))}

        {layout.elements.map((element) => (
          <SnakeChain
            key={element.key}
            element={element}
            labelY={layout.labelY}
            ink={ink}
            lit={highlight.segments.has(element.key) || highlight.arcs.has(element.key)}
            dim={anyLit}
            pointed={
              highlight.residue !== null &&
              highlight.residue >= element.start &&
              highlight.residue <= element.end
                ? highlight.residue
                : null
            }
          />
        ))}

        {layout.termini.map((terminus) => (
          <text
            key={terminus.label}
            x={terminus.x + (terminus.label === "N" ? -SNAKE.bead - 8 : SNAKE.bead + 8)}
            y={terminus.y}
            fontSize={12}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill={ink.label}
          >
            {terminus.label}
          </text>
        ))}
      </svg>
    </Box>
  )
})

export default SnakeDiagram
