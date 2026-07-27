// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type RefObject } from "react"
import { Box, Chip, Stack, Typography, useTheme } from "@mui/material"
import { TRACK } from "./constants"
import { layoutTopology } from "./topologyLayout"
import type { ProteinFeature } from "@/types/structure"

interface Props {
  features: ProteinFeature[]
  length: number
  width: number
  svgRef?: RefObject<SVGSVGElement | null>
}

export default function TopologyTrack({ features, length, width, svgRef }: Props) {
  const { palette } = useTheme()
  const layout = useMemo(() => layoutTopology(features, length, width), [features, length, width])

  const membraneFill = palette.mode === "dark" ? palette.grey[800] : palette.grey[200]
  const helixFill = palette.primary.main
  const siteColor = palette.secondary.main
  const axisColor = palette.text.disabled
  const labelColor = palette.text.secondary

  return (
    <Box>
      <Box sx={{ overflowX: "auto", overflowY: "hidden" }}>
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={TRACK.height}
          viewBox={`0 0 ${width} ${TRACK.height}`}
          role="img"
          aria-label={`Membrane topology of a ${length} residue protein with ${layout.helices.length} transmembrane helices`}
        >
          <rect
            x={0}
            y={TRACK.membraneTop}
            width={width}
            height={TRACK.membraneHeight}
            fill={membraneFill}
          />

          <text x={2} y={TRACK.outsideY - 6} fontSize={10} fill={labelColor}>
            Outside
          </text>
          <text x={2} y={TRACK.insideY + 14} fontSize={10} fill={labelColor}>
            Cytoplasm
          </text>

          {layout.loops.map((loop) => (
            <rect
              key={`loop-${loop.start}`}
              x={loop.x}
              y={loop.side === "inside" ? TRACK.insideY : TRACK.outsideY}
              width={loop.width}
              height={TRACK.loopThickness}
              rx={TRACK.loopThickness / 2}
              fill={axisColor}
            >
              <title>{`${loop.description ?? "Topological domain"} ${loop.start}-${loop.end}`}</title>
            </rect>
          ))}

          {layout.helices.map((helix) => (
            <g key={`tm-${helix.index}`}>
              <rect
                x={helix.x}
                y={TRACK.membraneTop}
                width={helix.width}
                height={TRACK.membraneHeight}
                rx={2}
                fill={helixFill}
                fillOpacity={0.85}
              >
                <title>{`TM${helix.index}: ${helix.start}-${helix.end}`}</title>
              </rect>
              {helix.width >= TRACK.minLabelWidth && (
                <text
                  x={helix.x + helix.width / 2}
                  y={TRACK.membraneTop + TRACK.membraneHeight / 2 + 4}
                  fontSize={10}
                  textAnchor="middle"
                  fill={palette.getContrastText(helixFill)}
                  style={{ pointerEvents: "none" }}
                >
                  {helix.index}
                </text>
              )}
            </g>
          ))}

          {layout.sites.map((site, i) => (
            <circle
              key={`site-${site.residue}-${i}`}
              cx={site.x}
              cy={TRACK.ligandY}
              r={3}
              fill={siteColor}
            >
              <title>{`${site.ligand} at residue ${site.residue}`}</title>
            </circle>
          ))}

          <line
            x1={TRACK.padX}
            y1={TRACK.axisY}
            x2={width - TRACK.padX}
            y2={TRACK.axisY}
            stroke={axisColor}
          />
          {layout.ticks.map((tick) => (
            <g key={`tick-${tick.residue}`}>
              <line
                x1={tick.x}
                y1={TRACK.axisY}
                x2={tick.x}
                y2={TRACK.axisY + 4}
                stroke={axisColor}
              />
              <text
                x={tick.x}
                y={TRACK.axisY + 15}
                fontSize={10}
                textAnchor="middle"
                fill={labelColor}
              >
                {tick.residue}
              </text>
            </g>
          ))}
        </svg>
      </Box>

      {layout.ligands.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
            Binding sites
          </Typography>
          {layout.ligands.map((ligand) => (
            <Chip
              key={ligand.name}
              size="small"
              variant="outlined"
              label={`${ligand.name} ×${ligand.count}`}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}
