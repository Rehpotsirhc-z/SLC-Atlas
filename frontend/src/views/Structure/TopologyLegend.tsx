// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Stack, Typography, useTheme } from "@mui/material"
import SwatchLegend, { type Swatch } from "@/components/SwatchLegend"
import { formatSpans } from "./bindingSites"
import { PLDDT_BANDS } from "./confidenceColor"
import { ligandColorAt } from "./ligandColor"
import type { TopologyLayout } from "./topologyLayout"

interface Props {
  layout: TopologyLayout
}

export default function TopologyLegend({ layout }: Props) {
  const { palette } = useTheme()

  const swatches: Swatch[] = layout.ligands.map((ligand, i) => ({
    key: ligand.name,
    color: ligandColorAt(i, palette.mode),
    label: ligand.name,
    detail:
      ligand.sites > 1
        ? `${ligand.sites} sites, ${ligand.residues} residues`
        : `${ligand.residues} ${ligand.residues === 1 ? "residue" : "residues"}`,
  }))

  const bands: Swatch[] = layout.confidence.length
    ? PLDDT_BANDS.map((band) => ({
        key: band.short,
        color: band.color,
        label: band.short,
        detail: band.range,
      }))
    : []

  const notes = [
    !layout.oriented &&
      "which face the chain starts on is convention, not annotation: UniProt marks no compartment, glycosylation, disulfide or signal peptide",
    layout.unresolved.length > 0 &&
      `residues ${formatSpans(layout.unresolved)} are drawn dashed: UniProt's compartments there cannot all be reached by alternating helices, so their faces are unresolved`,
  ].filter(Boolean) as string[]

  return (
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      <SwatchLegend title="Binds" swatches={swatches} />
      <SwatchLegend title="Confidence" swatches={bands} />
      <Typography variant="caption" color="text.secondary">
        {layout.membrane}
      </Typography>
      {notes.map((note) => (
        <Typography key={note} variant="caption" color="text.secondary">
          {note}
        </Typography>
      ))}
    </Stack>
  )
}
