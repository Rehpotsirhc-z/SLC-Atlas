// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, type RefObject } from "react"
import { alpha, Box, useTheme } from "@mui/material"
import { confidenceColor } from "./confidenceColor"
import { DIM_OPACITY, SEQUENCE, TRACK } from "./constants"
import type { FeaturesLayout } from "./featuresLayout"
import { ligandColorAt } from "./ligandColor"
import type { TargetSets, TopologyTarget } from "./topologyTargets"

interface Props {
  layout: FeaturesLayout
  length: number
  plddt: number[] | null
  highlight: TargetSets
  onHover: (event: React.MouseEvent, target: TopologyTarget) => void
  onLeave: () => void
  onSelect: (target: TopologyTarget) => void
  svgRef?: RefObject<SVGSVGElement | null>
}

const FeaturesDiagram = memo(function FeaturesDiagram({
  layout,
  length,
  plddt,
  highlight,
  onHover,
  onLeave,
  onSelect,
  svgRef,
}: Props) {
  const { palette, custom, typography } = useTheme()

  const plotWidth = layout.plotRight - layout.plotLeft
  const anyLit = highlight.marks.size + highlight.sites.size > 0
  const dimmed = (lit: boolean) => (anyLit && !lit ? DIM_OPACITY : 1)

  const railFill = alpha(palette.text.primary, palette.mode === "dark" ? 0.22 : 0.16)
  const railEdge = alpha(palette.text.primary, palette.mode === "dark" ? 0.32 : 0.24)
  const signalFill = palette.primary.main
  const gridStroke = alpha(palette.text.primary, palette.mode === "dark" ? 0.09 : 0.07)
  const markInk = palette.text.primary
  const stemStroke = palette.text.secondary
  const litInk = palette.secondary.main
  const axisColor = palette.text.disabled
  const labelColor = palette.text.secondary

  const residueAt = (event: React.MouseEvent<SVGElement>): number | null => {
    const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!box) return null
    const scale = layout.width / box.width
    const local = (event.clientX - box.left) * scale
    const t = (local - layout.plotLeft) / Math.max(plotWidth, 1)
    return Math.min(Math.max(Math.round(1 + t * (length - 1)), 1), length)
  }

  return (
    <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Sequence features: ${layout.marks.length} annotated residues across ${length} residues`}
        fontFamily={typography.fontFamily}
        onMouseLeave={onLeave}
      >
        {layout.ticks.map((tick) => (
          <line
            key={`grid-${tick.residue}`}
            x1={tick.x}
            y1={layout.railTop}
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

        <rect
          x={layout.plotLeft}
          y={layout.railTop}
          width={plotWidth}
          height={SEQUENCE.railHeight}
          rx={SEQUENCE.railRadius}
          fill={railFill}
          stroke={railEdge}
        />

        {layout.signal && (
          <g
            data-testid={`signal-${layout.signal.key}`}
            opacity={dimmed(highlight.marks.has(layout.signal.key))}
            onMouseMove={(e) => onHover(e, { kind: "signal", item: layout.signal! })}
            onMouseLeave={onLeave}
            onClick={() => onSelect({ kind: "signal", item: layout.signal! })}
            style={{ cursor: "pointer" }}
          >
            <rect
              x={layout.signal.x}
              y={layout.railTop}
              width={layout.signal.width}
              height={SEQUENCE.railHeight}
              rx={SEQUENCE.railRadius}
              fill={signalFill}
            />
          </g>
        )}

        {layout.termini.map((terminus) => (
          <text
            key={terminus.label}
            x={terminus.x + (terminus.label === "N" ? -SEQUENCE.terminusGap : SEQUENCE.terminusGap)}
            y={(layout.railTop + layout.railBottom) / 2}
            fontSize={11}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill={labelColor}
          >
            {terminus.label}
          </text>
        ))}

        {layout.marks.map((mark) => {
          const filled = mark.kind === "glycosylation"
          const lit = highlight.marks.has(mark.key)
          return (
            <g
              key={mark.key}
              data-testid={`mark-${mark.key}`}
              opacity={dimmed(lit)}
              onMouseMove={(e) => onHover(e, { kind: "mark", item: mark })}
              onMouseLeave={onLeave}
              onClick={() => onSelect({ kind: "mark", item: mark })}
              style={{ cursor: "pointer" }}
            >
              <line
                x1={mark.x}
                y1={layout.railTop}
                x2={mark.x}
                y2={mark.y}
                stroke={stemStroke}
                strokeWidth={1}
              />
              <circle
                cx={mark.x}
                cy={mark.y}
                r={SEQUENCE.markRadius}
                fill={filled ? markInk : palette.background.paper}
                stroke={lit ? litInk : markInk}
                strokeWidth={lit ? SEQUENCE.litStroke : SEQUENCE.markStroke}
              />

              <rect
                x={mark.x - SEQUENCE.hitRadius}
                y={mark.y - SEQUENCE.hitRadius}
                width={SEQUENCE.hitRadius * 2}
                height={layout.railBottom - mark.y + SEQUENCE.hitRadius}
                fill="transparent"
              />
            </g>
          )
        })}

        {layout.sites.map((site) => {
          const color = ligandColorAt(site.ligandIndex, palette.mode)
          return (
            <g
              key={site.key}
              data-testid={`site-${site.key}`}
              opacity={dimmed(highlight.sites.has(site.key))}
              onMouseMove={(e) => onHover(e, { kind: "site", item: site })}
              onMouseLeave={onLeave}
              onClick={() => onSelect({ kind: "site", item: site })}
              style={{ cursor: "pointer" }}
            >
              <line
                x1={site.connectorFrom}
                y1={site.y}
                x2={site.connectorTo}
                y2={site.y}
                stroke={color}
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
                  fill={color}
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
          <g
            onMouseMove={(e) => {
              const residue = residueAt(e)
              const score = residue && plddt ? plddt[residue - 1] : undefined
              if (residue && score != null) {
                onHover(e, { kind: "confidence", residue, score })
              }
            }}
            onMouseLeave={onLeave}
          >
            {layout.confidence.map((bar) => {
              const x = layout.plotLeft + bar.from * plotWidth
              const end = layout.plotLeft + bar.to * plotWidth
              return (
                <rect
                  key={bar.from}
                  x={x}
                  y={layout.confidenceTop}
                  width={end - x + (bar.to < 1 ? 0.5 : 0)}
                  height={layout.confidenceHeight}
                  fill={confidenceColor(bar.score)}
                />
              )
            })}
            <rect
              x={layout.plotLeft}
              y={layout.confidenceTop}
              width={plotWidth}
              height={layout.confidenceHeight}
              fill="none"
              stroke={railEdge}
            />
          </g>
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
          x={TRACK.gutter - 8}
          y={layout.axisY}
          fontSize={11}
          textAnchor="end"
          dominantBaseline="central"
          fill={labelColor}
        >
          Residue number
        </text>
      </svg>
    </Box>
  )
})

export default FeaturesDiagram
