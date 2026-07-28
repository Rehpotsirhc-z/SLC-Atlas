// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useId, type RefObject } from "react"
import { alpha, Box, useTheme } from "@mui/material"
import { useConfidenceColor } from "./confidenceColor"
import { TRACK } from "./constants"
import { ligandColorAt } from "./ligandColor"
import TopologyLegend from "./TopologyLegend"
import TopologyTooltip from "./TopologyTooltip"
import type { useTopologyState } from "./useTopologyState"

interface Props {
  length: number
  plddt: number[] | null
  topology: ReturnType<typeof useTopologyState>
  svgRef?: RefObject<SVGSVGElement | null>
}

export default function TopologyFigure({ length, plddt, topology, svgRef }: Props) {
  const { palette, custom } = useTheme()
  const confidenceColor = useConfidenceColor()
  const confidenceGradientId = useId()

  const { layout, hover, track, clear, highlight, dimmed, select, clearFocus } = topology

  const helixFill = palette.primary.main
  const membraneFill = alpha(palette.text.primary, palette.mode === "dark" ? 0.09 : 0.06)
  const membraneEdge = alpha(palette.text.primary, palette.mode === "dark" ? 0.22 : 0.16)
  const gridStroke = alpha(palette.text.primary, palette.mode === "dark" ? 0.09 : 0.07)
  const chainStroke = palette.text.secondary
  const axisColor = palette.text.disabled
  const labelColor = palette.text.secondary

  // Which residue the cursor is over, from its x within the plot area
  const residueAt = (event: React.MouseEvent<SVGElement>): number | null => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!box) return null
    const scale = layout.width / box.width
    const local = (event.clientX - box.left) * scale
    const t = (local - layout.plotLeft) / Math.max(layout.plotRight - layout.plotLeft, 1)
    return Math.min(Math.max(Math.round(1 + t * (length - 1)), 1), length)
  }

  return (
    <Box>
      <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Membrane topology: ${layout.cylinders.length} membrane segments across ${length} residues`}
          onMouseLeave={clear}
          onClick={clearFocus}
        >
          {/* The bilayer */}
          <rect
            x={layout.plotLeft - TRACK.padX}
            y={layout.membraneTop}
            width={layout.plotRight - layout.plotLeft + TRACK.padX * 2}
            height={layout.membraneBottom - layout.membraneTop}
            fill={membraneFill}
          />
          {[layout.membraneTop, layout.membraneBottom].map((y) => (
            <line
              key={y}
              x1={layout.plotLeft - TRACK.padX}
              y1={y}
              x2={layout.plotRight + TRACK.padX}
              y2={y}
              stroke={membraneEdge}
            />
          ))}

          {/* Ties the ruler at the bottom to everything stacked above it */}
          {layout.ticks.map((tick) => (
            <line
              key={`grid-${tick.residue}`}
              x1={tick.x}
              y1={0}
              x2={tick.x}
              y2={layout.axisY}
              stroke={gridStroke}
            />
          ))}

          {layout.lanes.map((lane) => (
            <text
              key={lane.key}
              x={TRACK.gutter - 8}
              y={lane.y}
              fontSize={11}
              textAnchor="end"
              dominantBaseline="central"
              fill={labelColor}
            >
              {lane.label}
            </text>
          ))}

          {/* Drawn before the pills so they cover where the curves meet them */}
          {layout.arcs.map((arc) => (
            <g
              key={arc.key}
              opacity={dimmed(highlight.arcs.has(arc.key))}
              onMouseMove={(e) => arc.residues && track(e, { kind: "arc", item: arc })}
              onMouseLeave={clear}
              onClick={(e) => {
                if (!arc.residues) return
                // Otherwise the click reaches the canvas, which reads as a dismissal
                e.stopPropagation()
                select({ kind: "arc", item: arc })
              }}
              style={{ cursor: arc.residues ? "pointer" : "default" }}
            >
              <path
                d={arc.path}
                fill="none"
                stroke={chainStroke}
                strokeWidth={TRACK.chainWidth}
                strokeLinecap="round"
                strokeDasharray={arc.unresolved ? TRACK.unresolvedDash : undefined}
              />
              {/* A 2px stroke is near impossible to hit, and the termini carry binding
                  residues in 24 genes */}
              {arc.residues > 0 && (
                <path
                  d={arc.path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={TRACK.chainHitWidth}
                />
              )}
            </g>
          ))}

          {layout.termini.map((terminus) => (
            <text
              key={terminus.label}
              x={terminus.x + (terminus.label === "N" ? -9 : 9)}
              y={terminus.y + (terminus.y <= layout.membraneTop ? -9 : 9)}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              fill={labelColor}
            >
              {terminus.label}
            </text>
          ))}

          {layout.cylinders.map((cylinder) => {
            const crosses = cylinder.kind === "transmembrane"
            return (
              <g
                key={cylinder.key}
                data-testid={`segment-${cylinder.key}`}
                opacity={dimmed(highlight.segments.has(cylinder.key))}
                onMouseMove={(e) => track(e, { kind: "segment", item: cylinder })}
                onMouseLeave={clear}
                onClick={(e) => {
                  e.stopPropagation()
                  select({ kind: "segment", item: cylinder })
                }}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={cylinder.x}
                  y={cylinder.drawTop}
                  width={cylinder.width}
                  height={cylinder.drawBottom - cylinder.drawTop}
                  rx={cylinder.cap}
                  ry={cylinder.cap}
                  fill={crosses ? helixFill : alpha(helixFill, 0.45)}
                  stroke={cylinder.unresolved ? chainStroke : crosses ? "none" : helixFill}
                  strokeDasharray={cylinder.unresolved ? TRACK.unresolvedDash : undefined}
                />
                {cylinder.showLabel && (
                  <text
                    x={cylinder.x + cylinder.width / 2}
                    // Centred on the stretch inside the membrane, not the pill whose cap
                    // pokes past the edge
                    y={(cylinder.top + cylinder.bottom) / 2}
                    fontSize={11}
                    fontWeight={600}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={crosses ? palette.getContrastText(helixFill) : palette.text.primary}
                    stroke={crosses ? helixFill : membraneFill}
                    strokeWidth={2.5}
                    paintOrder="stroke"
                    style={{ pointerEvents: "none" }}
                  >
                    {cylinder.label}
                  </text>
                )}
              </g>
            )
          })}

          {layout.sites.map((site) => {
            const colour = ligandColorAt(
              layout.ligands.findIndex((l) => l.name === site.ligand),
              palette.mode,
            )
            return (
              <g
                key={site.key}
                data-testid={`site-${site.key}`}
                opacity={dimmed(highlight.sites.has(site.key))}
                onMouseMove={(e) => track(e, { kind: "site", item: site })}
                onMouseLeave={clear}
                onClick={(e) => {
                  e.stopPropagation()
                  select({ kind: "site", item: site })
                }}
                style={{ cursor: "pointer" }}
              >
                {/* Joined so residues hundreds apart still read as one site */}
                <line
                  x1={site.connectorFrom}
                  y1={site.y}
                  x2={site.connectorTo}
                  y2={site.y}
                  stroke={colour}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                {site.bars.map((bar) => (
                  <rect
                    key={bar.key}
                    x={bar.x}
                    y={site.y - TRACK.siteBarHeight / 2}
                    width={bar.width}
                    height={TRACK.siteBarHeight}
                    rx={1}
                    fill={colour}
                  />
                ))}
                <rect
                  x={site.connectorFrom - TRACK.siteBarMinWidth}
                  y={site.y - TRACK.siteRow / 2}
                  width={site.connectorTo - site.connectorFrom + TRACK.siteBarMinWidth * 2}
                  height={TRACK.siteRow}
                  fill="transparent"
                />
              </g>
            )
          })}

          {layout.confidenceHeight > 0 && (
            <>
              <defs>
                <linearGradient
                  id={confidenceGradientId}
                  gradientUnits="userSpaceOnUse"
                  x1={layout.plotLeft}
                  x2={layout.plotRight}
                >
                  {layout.confidence.map((stop) => (
                    <stop
                      key={stop.offset}
                      offset={stop.offset}
                      stopColor={confidenceColor(stop.score)}
                    />
                  ))}
                </linearGradient>
              </defs>
              <rect
                x={layout.plotLeft}
                y={layout.confidenceTop}
                width={layout.plotRight - layout.plotLeft}
                height={layout.confidenceHeight}
                fill={`url(#${confidenceGradientId})`}
                stroke={membraneEdge}
                onMouseMove={(e) => {
                  const residue = residueAt(e)
                  const score = residue && plddt ? plddt[residue - 1] : undefined
                  if (residue && score != null) {
                    track(e, { kind: "confidence", residue, score })
                  }
                }}
                onMouseLeave={clear}
              />
            </>
          )}

          <line
            x1={layout.plotLeft}
            y1={layout.axisY}
            x2={layout.plotRight}
            y2={layout.axisY}
            stroke={axisColor}
          />
          {layout.ticks.map((tick) => (
            <g key={tick.residue}>
              <line
                x1={tick.x}
                y1={layout.axisY}
                x2={tick.x}
                y2={layout.axisY + 4}
                stroke={axisColor}
              />
              <text
                x={tick.x}
                y={layout.axisLabelY}
                fontSize={10}
                fontFamily={custom.monoFontFamily}
                textAnchor="middle"
                fill={labelColor}
              >
                {tick.residue}
              </text>
            </g>
          ))}
          <text
            x={(layout.plotLeft + layout.plotRight) / 2}
            y={layout.axisTitleY}
            fontSize={11}
            textAnchor="middle"
            fill={labelColor}
          >
            Residue number
          </text>
        </svg>
      </Box>

      <TopologyLegend layout={layout} />

      {hover && <TopologyTooltip hover={hover} layout={layout} />}
    </Box>
  )
}
