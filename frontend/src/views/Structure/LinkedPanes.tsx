// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, type ReactNode, type RefObject } from "react"
import { Box, Stack, Typography } from "@mui/material"
import InfoTooltip from "@/components/InfoTooltip"
import { capBoxSx } from "@/theme"
import { useElementSize } from "@/utils/useElementSize"
import { COLUMN_GAP, TRACK, VIEWER_MIN_HEIGHT } from "./constants"
import LinkedResidues from "./LinkedResidues"
import ModelSwitcher from "./ModelSwitcher"
import ModelViewerPanel from "./ModelViewerPanel"
import { PREDICTED_ID } from "./modelOptions"
import SnakeFigure from "./SnakeFigure"
import TopologyFigure from "./TopologyFigure"
import TopologyGuide from "./TopologyGuide"
import TopologyModeToggle from "./TopologyModeToggle"
import { useTopologyState, type TopologyMode } from "./useTopologyState"
import type { ProteinFeature, StructureRecord } from "@/types/structure"
import type { ModelOption } from "./modelOptions"
import type { ModelExporter, ModelSource } from "./molstar/types"

interface Props {
  identity: ReactNode
  structure: StructureRecord
  features: ProteinFeature[] | undefined
  plddt: number[] | null
  sequence: string | null
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
  identity,
  structure,
  features,
  plddt,
  sequence,
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
  const [mode, setMode] = useState<TopologyMode>("linear")

  const topology = useTopologyState({
    features: features ?? [],
    length: structure.uniprot_length ?? 0,
    width: trackWidth,
    plddt,
    sequence,
    protein: structure.uniprot_accession ?? null,
    mode,
  })

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
        sx={{ flex: sideBySide ? "6 1 0" : "none", minWidth: 0 }}
      >
        {identity}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 3, mb: 1 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="overline" color="primary" sx={capBoxSx}>
              Membrane topology
            </Typography>
            <TopologyGuide mode={mode} />
          </Stack>
          <TopologyModeToggle mode={mode} onChange={setMode} />
        </Stack>
        {features?.length && structure.uniprot_length ? (
          <Box sx={{ overflowX: "auto" }}>
            {mode === "linear" ? (
              <TopologyFigure
                svgRef={svgRef}
                model={topology.model}
                layout={topology.layout}
                plddt={plddt}
                topology={topology}
              />
            ) : (
              <SnakeFigure
                svgRef={svgRef}
                model={topology.model}
                layout={topology.snake}
                topology={topology}
              />
            )}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            UniProt has no topology annotation for this protein.
          </Typography>
        )}
      </Box>

      <Box
        data-testid="model-column"
        sx={{
          flex: sideBySide ? "4 1 0" : "none",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
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
        <Box
          sx={{ flex: 1, minHeight: VIEWER_MIN_HEIGHT, display: "flex", flexDirection: "column" }}
        >
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
        </Box>
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
