// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Fragment, memo, type ReactNode } from "react"
import { Box, Typography, useTheme } from "@mui/material"
import SwatchLegend, { type Swatch } from "@/components/SwatchLegend"
import { formatSpans } from "./bindingSites"
import { PLDDT_BANDS } from "./confidenceColor"
import { TRACK } from "./constants"
import { ligandColorAt } from "./ligandColor"
import type { TopologyLayout } from "./topologyLayout"

interface Props {
  layout: TopologyLayout
}

interface Row {
  key: string
  label: string
  content: ReactNode
}

const TopologyLegend = memo(function TopologyLegend({ layout }: Props) {
  const { palette, custom } = useTheme()

  const valueSx = {
    fontFamily: custom.monoFontFamily,
    fontSize: 10,
    lineHeight: 1,
    color: "text.primary",
  }

  const ligands: Swatch[] = layout.ligands.map((ligand, i) => ({
    key: ligand.name,
    color: ligandColorAt(i, palette.mode),
    label: ligand.name,
    detail:
      ligand.sites > 1
        ? `${ligand.sites} sites, ${ligand.residues} residues`
        : `${ligand.residues} ${ligand.residues === 1 ? "residue" : "residues"}`,
  }))

  const bands: Swatch[] = PLDDT_BANDS.map((band) => ({
    key: band.short,
    color: band.color,
    label: band.short,
    detail: band.range,
  }))

  const rows: Row[] = []
  if (ligands.length) {
    rows.push({ key: "binds", label: "Binds", content: <SwatchLegend swatches={ligands} /> })
  }
  if (layout.confidence.length) {
    rows.push({
      key: "confidence",
      label: "Confidence",
      content: <SwatchLegend swatches={bands} />,
    })
  }
  if (layout.membrane) {
    rows.push({
      key: "membrane",
      label: "Membrane",
      content: <Typography sx={valueSx}>{layout.membrane}</Typography>,
    })
  }
  if (!layout.oriented) {
    rows.push({
      key: "sides",
      label: "Sides",
      content: (
        <Typography sx={{ ...valueSx, color: "text.secondary" }}>
          UniProt does not say which side is which, so the figure picked one
        </Typography>
      ),
    })
  }
  if (layout.unresolved.length) {
    rows.push({
      key: "unresolved",
      label: "Unresolved",
      content: (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box component="svg" width={22} height={8} sx={{ flexShrink: 0 }}>
            <line
              x1={1}
              y1={4}
              x2={21}
              y2={4}
              stroke={palette.text.secondary}
              strokeWidth={TRACK.chainWidth}
              strokeDasharray={TRACK.unresolvedDash}
            />
          </Box>
          <Typography sx={valueSx}>{`residues ${formatSpans(layout.unresolved)}`}</Typography>
        </Box>
      ),
    })
  }

  if (!rows.length) return null

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
      <Box
        sx={{
          display: "inline-grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: 1.5,
          rowGap: 0.75,
          alignItems: "center",
          px: 1.25,
          py: 1,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        {rows.map((row) => (
          <Fragment key={row.key}>
            {/* Same metrics as the values, so centring the cells lands them on one baseline */}
            <Typography sx={{ ...valueSx, fontWeight: 700, color: "text.secondary" }}>
              {row.label}
            </Typography>
            {row.content}
          </Fragment>
        ))}
      </Box>
    </Box>
  )
})

export default TopologyLegend
