// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Fragment, memo, type ReactNode } from "react"
import { Box, Typography, useTheme, type SxProps, type Theme } from "@mui/material"
import SwatchLegend, { type Swatch } from "@/components/SwatchLegend"
import { formatSpans } from "./bindingSites"
import { PLDDT_BANDS } from "./confidenceColor"
import { TRACK } from "./constants"
import { ligandColorAt } from "./ligandColor"
import type { ChainModel } from "./chainModel"

interface Props {
  model: ChainModel
  hasConfidence: boolean
  // How the figure marks a stretch whose sides the annotation cannot settle
  unresolvedAs?: "line" | "ring"
  variant?: "membrane" | "sequence"
}

interface Row {
  key: string
  label: string
  content: ReactNode
}

const LINE = 10
const DASH_WIDTH = 22
const SIGNAL_WIDTH = 16

const MARK_SHAPES = [
  { kind: "glycosylation", label: "Glycosylation", filled: true },
  { kind: "disulfide_bond", label: "Disulfide cysteine", filled: false },
] as const

function MarkKey({ model, sx }: { model: ChainModel; sx: SxProps<Theme> }) {
  const { palette } = useTheme()
  const kinds = new Set(model.marks.map((mark) => mark.kind))
  const shapes = MARK_SHAPES.filter((shape) => kinds.has(shape.kind))

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
      {shapes.map((shape) => (
        <Box key={shape.kind} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box component="svg" width={LINE} height={LINE} sx={{ flexShrink: 0 }}>
            <circle
              cx={LINE / 2}
              cy={LINE / 2}
              r={LINE / 2 - 1}
              fill={shape.filled ? palette.text.primary : "none"}
              stroke={palette.text.primary}
              strokeWidth={1.5}
            />
          </Box>
          <Typography sx={sx}>{shape.label}</Typography>
        </Box>
      ))}
      {model.signal && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box component="svg" width={SIGNAL_WIDTH} height={LINE} sx={{ flexShrink: 0 }}>
            <rect width={SIGNAL_WIDTH} height={LINE} rx={2} fill={palette.primary.main} />
          </Box>
          <Typography sx={sx}>
            {`Signal peptide ${model.signal.start}–${model.signal.end}`}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

const TopologyLegend = memo(function TopologyLegend({
  model,
  hasConfidence,
  unresolvedAs = "line",
  variant = "membrane",
}: Props) {
  const { palette, custom } = useTheme()
  const membrane = variant === "membrane"

  const valueSx = {
    fontFamily: custom.monoFontFamily,
    fontSize: LINE,
    lineHeight: 1,
    color: "text.primary",
  }

  const ligands: Swatch[] = model.ligands.map((ligand, i) => ({
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
  if (!membrane && (model.marks.length > 0 || model.signal)) {
    rows.push({
      key: "marks",
      label: "Marks",
      content: <MarkKey model={model} sx={valueSx} />,
    })
  }
  if (ligands.length) {
    rows.push({ key: "binds", label: "Binds", content: <SwatchLegend swatches={ligands} /> })
  }
  if (hasConfidence) {
    rows.push({
      key: "confidence",
      label: "Confidence",
      content: <SwatchLegend swatches={bands} />,
    })
  }
  if (membrane && model.membrane) {
    rows.push({
      key: "membrane",
      label: "Membrane",
      content: <Typography sx={valueSx}>{model.membrane}</Typography>,
    })
  }
  if (membrane && !model.oriented) {
    rows.push({
      key: "orientation",
      label: "Orientation",
      content: (
        <Typography sx={{ ...valueSx, color: "text.secondary" }}>
          Assumed, N-terminus cytoplasmic
        </Typography>
      ),
    })
  }
  if (membrane && model.unresolved.length) {
    rows.push({
      key: "unresolved",
      label: "Unresolved",
      content: (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            component="svg"
            width={unresolvedAs === "ring" ? LINE : DASH_WIDTH}
            height={LINE}
            sx={{ flexShrink: 0 }}
          >
            {unresolvedAs === "ring" ? (
              <circle
                cx={LINE / 2}
                cy={LINE / 2}
                r={(LINE - TRACK.chainWidth) / 2}
                fill="none"
                stroke={palette.text.secondary}
                strokeWidth={TRACK.chainWidth}
                strokeDasharray={TRACK.unresolvedDash}
              />
            ) : (
              <line
                x1={1}
                y1={LINE / 2}
                x2={DASH_WIDTH - 1}
                y2={LINE / 2}
                stroke={palette.text.secondary}
                strokeWidth={TRACK.chainWidth}
                strokeDasharray={TRACK.unresolvedDash}
              />
            )}
          </Box>
          <Typography sx={valueSx}>{`residues ${formatSpans(model.unresolved)}`}</Typography>
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
