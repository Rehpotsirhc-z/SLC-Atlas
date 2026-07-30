// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, type RefObject } from "react"
import { Box, Stack, Typography } from "@mui/material"
import InfoTooltip from "@/components/InfoTooltip"
import { capBoxSx } from "@/theme"
import { useElementSize } from "@/utils/useElementSize"
import { COLUMN_GAP, TRACK } from "./constants"
import LinkedResidues from "./LinkedResidues"
import ModelSwitcher from "./ModelSwitcher"
import ModelViewerPanel from "./ModelViewerPanel"
import { PREDICTED_ID } from "./modelOptions"
import TopologyFigure from "./TopologyFigure"
import { useTopologyState } from "./useTopologyState"
import type { ProteinFeature, StructureRecord } from "@/types/structure"
import type { ModelOption } from "./modelOptions"
import type { ModelExporter, ModelSource } from "./molstar/types"

interface Props {
  structure: StructureRecord
  features: ProteinFeature[] | undefined
  plddt: number[] | null
  modelSource: ModelSource | null
  modelOptions: ModelOption[]
  selectedPdbId: string | null
  onSelectPdbId: (pdbId: string | null) => void
  sideBySide: boolean
  isMobile: boolean
  svgRef: RefObject<SVGSVGElement | null>
  onExporterChange: (exporter: ModelExporter | null) => void
}

export default function LinkedPanes({
  structure,
  features,
  plddt,
  modelSource,
  modelOptions,
  selectedPdbId,
  onSelectPdbId,
  sideBySide,
  isMobile,
  svgRef,
  onExporterChange,
}: Props) {
  const selectModel = useCallback(
    (id: string) => onSelectPdbId(id === PREDICTED_ID ? null : id),
    [onSelectPdbId],
  )
  const [figureRef, figureBox] = useElementSize<HTMLDivElement>("content")
  // Floored so a fractional column width cannot leave the figure a sub-pixel too wide
  const trackWidth = Math.max(Math.floor(figureBox.w), TRACK.minWidth)

  const topology = useTopologyState(
    features ?? [],
    structure.uniprot_length ?? 0,
    trackWidth,
    plddt,
    structure.uniprot_accession ?? null,
  )

  return (
    <Box
      data-testid="figure-row"
      data-side-by-side={sideBySide}
      sx={{
        display: "flex",
        flexDirection: sideBySide ? "row" : "column",
        gap: `${COLUMN_GAP}px`,
        alignItems: "stretch",
      }}
    >
      <Box
        ref={figureRef}
        data-testid="topology-column"
        sx={{ flex: sideBySide ? "6 1 0" : "none", minWidth: 0, overflowX: "auto" }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="overline" color="primary" sx={capBoxSx}>
            Membrane topology
          </Typography>
          <InfoTooltip label="How to read the topology diagram">
            <Typography variant="caption" component="p">
              The x axis is the residue number, so every mark sits at the residues it covers and a
              helix is as wide as it is long. The curve threading the figure is the protein chain,
              N-terminus at left. The solid cylinders in the membrane band are transmembrane
              helices, numbered in order; the paler, half-height cylinders sit inside the membrane
              without crossing it. Between cylinders the chain loops onto whichever side of the
              membrane UniProt puts that stretch on.
            </Typography>
            <Typography variant="caption" component="p">
              Each row under Binds is one binding site; the blocks in it are the residues that touch
              the ligand named in the key below. The Confidence strip is AlphaFold&apos;s
              per-residue score, banded in the same four colours as the 3D model; hover it for the
              score at a residue.
            </Typography>
            <Typography variant="caption" component="p">
              A dashed line is one where UniProt&apos;s own compartments cannot all be reached by
              alternating helices, so the helices in it may be flipped.
            </Typography>
          </InfoTooltip>
        </Stack>
        {features?.length && structure.uniprot_length ? (
          <TopologyFigure
            svgRef={svgRef}
            length={structure.uniprot_length}
            plddt={plddt}
            topology={topology}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            UniProt has no topology annotation for this protein.
          </Typography>
        )}
      </Box>

      <Box data-testid="model-column" sx={{ flex: sideBySide ? "4 1 0" : "none", minWidth: 0 }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="overline" color="primary" sx={capBoxSx}>
            3D model
          </Typography>
          <InfoTooltip label="How to read the 3D model">
            <Typography variant="caption" component="p">
              The predicted model, coloured by AlphaFold&apos;s per-residue confidence. Hovering on
              either view lights the same residues in the other, and clicking a helix, loop or site
              in the figure brings its residues into view here.
            </Typography>
          </InfoTooltip>
        </Stack>
        <ModelViewerPanel
          source={modelSource}
          deferLoad={isMobile}
          highlightSpans={topology.highlightSpans}
          cameraSpans={topology.cameraSpans}
          modelOptions={modelOptions}
          selectedModelId={selectedPdbId ?? PREDICTED_ID}
          onSelectModel={selectModel}
          onResidueHover={topology.hoverResidue}
          onExporterChange={onExporterChange}
        />
        <Stack spacing={1} sx={{ mt: 1 }}>
          {modelOptions.length > 1 && (
            <ModelSwitcher
              options={modelOptions}
              selectedPdbId={selectedPdbId}
              onSelect={onSelectPdbId}
            />
          )}
          <LinkedResidues
            highlightSpans={topology.highlightSpans}
            linkable={modelSource?.kind === "afdb"}
          />
        </Stack>
      </Box>
    </Box>
  )
}
