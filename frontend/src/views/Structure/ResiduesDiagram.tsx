// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo, type RefObject } from "react"
import { alpha, Box, useTheme } from "@mui/material"
import BeadChain from "./BeadChain"
import { beadNear } from "./beadHitTest"
import type { BeadInk } from "./beadInk"
import { PLDDT_BANDS } from "./confidenceColor"
import { DIM_OPACITY, RESIDUES } from "./constants"
import { ligandColorAt } from "./ligandColor"
import LitBead from "./LitBead"
import { beadAt, type ResiduesLayout } from "./residuesLayout"
import type { TargetSets, TopologyTarget } from "./topologyTargets"

interface Props {
  layout: ResiduesLayout
  highlight: TargetSets
  onHover: (event: React.MouseEvent, target: TopologyTarget) => void
  onLeave: () => void
  onSelect: (target: TopologyTarget) => void
  svgRef?: RefObject<SVGSVGElement | null>
  scrollRef?: RefObject<HTMLDivElement | null>
}

const pointIn = (event: React.MouseEvent<SVGSVGElement>, layout: ResiduesLayout) => {
  const box = event.currentTarget.getBoundingClientRect()
  return {
    x: ((event.clientX - box.left) / box.width) * layout.width,
    y: ((event.clientY - box.top) / box.height) * layout.height,
  }
}

const ResiduesDiagram = memo(function ResiduesDiagram({
  layout,
  highlight,
  onHover,
  onLeave,
  onSelect,
  svgRef,
  scrollRef,
}: Props) {
  const { palette, typography } = useTheme()

  const ink: BeadInk = useMemo(
    () => ({
      chain: palette.text.secondary,
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
    (event: React.MouseEvent<SVGSVGElement>): TopologyTarget | null => {
      const { x, y } = pointIn(event, layout)
      const bead = beadNear(layout.hits, x, y)
      return bead
        ? { kind: "residue", residue: bead.residue, letter: bead.letter, score: bead.score }
        : null
    },
    [layout],
  )

  const onMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const target = targetAt(event)
      if (target) onHover(event, target)
      else onLeave()
    },
    [targetAt, onHover, onLeave],
  )

  const onClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const target = targetAt(event)
      if (target) onSelect(target)
    },
    [targetAt, onSelect],
  )

  const pointed = useMemo(() => beadAt(layout, highlight.residue), [layout, highlight.residue])

  return (
    <Box
      ref={scrollRef}
      sx={{
        overflowX: "auto",
        overflowY: "hidden",
        cursor: highlight.residue === null ? "default" : "pointer",
      }}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Membrane topology by residue: ${layout.length} residues across ${layout.elements.length} stretches of chain`}
        fontFamily={typography.fontFamily}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
      >
        <rect
          x={RESIDUES.gutter}
          y={layout.membraneTop}
          width={Math.max(layout.width - RESIDUES.gutter, 0)}
          height={layout.membraneBottom - layout.membraneTop}
          fill={membraneFill}
        />
        {[layout.membraneTop, layout.membraneBottom].map((y) => (
          <line
            key={y}
            x1={RESIDUES.gutter}
            y1={y}
            x2={layout.width}
            y2={y}
            stroke={membraneEdge}
          />
        ))}

        {layout.lanes.map((lane) => (
          <text
            key={lane.key}
            x={RESIDUES.gutter - 8}
            y={lane.y}
            fontSize={11}
            textAnchor="end"
            dominantBaseline="central"
            fill={ink.label}
          >
            {lane.label}
          </text>
        ))}

        <g opacity={pointed ? DIM_OPACITY : 1}>
          {layout.elements.map((element) => (
            <BeadChain key={element.key} element={element} labelY={layout.labelY} ink={ink} />
          ))}
        </g>

        {pointed && (
          <LitBead bead={pointed.bead} unresolved={pointed.element.unresolved} ink={ink} />
        )}

        {layout.termini.map((terminus) => (
          <text
            key={terminus.label}
            x={terminus.x + (terminus.label === "N" ? -RESIDUES.bead - 8 : RESIDUES.bead + 8)}
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

export default ResiduesDiagram
