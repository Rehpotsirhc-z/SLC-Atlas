// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Alert,
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { useCapability } from "@/api/hooks/useCapabilities"
import InfoPopover from "@/components/InfoPopover"
import FamilyRail from "@/components/view/FamilyRail"
import { useFamilyRail } from "@/components/view/useFamilyRail"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { figureExportHandlers } from "@/utils/exportFigure"
import {
  COLUMN_GAP,
  CONTENT_PADDING_PX,
  MIN_CONTENT_WIDTH,
  PREFERRED_CONTENT_WIDTH,
  SIDE_BY_SIDE_MIN_WIDTH,
  TOPOLOGY_FRACTION,
  TRACK,
} from "./constants"
import ExperimentalTable from "./ExperimentalTable"
import IdentityCard from "./IdentityCard"
import LinkedResidues from "./LinkedResidues"
import ModelCaveats from "./ModelCaveats"
import ModelSwitcher from "./ModelSwitcher"
import ModelViewerPanel from "./ModelViewerPanel"
import StructureSummary from "./StructureSummary"
import StructureToolbar from "./StructureToolbar"
import TopologyFigure from "./TopologyFigure"
import { useStructureState } from "./useStructureState"
import { useTopologyState } from "./useTopologyState"
import type { ModelExporter } from "./molstar/types"

export default function Structure() {
  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"))
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Present only while the viewer is mounted, which is what gates the export menu entry
  const [exportModelPng, setExportModelPng] = useState<ModelExporter | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const available = useCapability("structure")

  const {
    structures,
    genes,
    selected,
    plddt,
    selectedGene,
    features,
    experimental,
    isLoading,
    error,
    familyFilter,
    setFamilyFilter,
    setSelectedGeneId,
    modelSource,
    selectedPdbId,
    selectPdbId,
    counterText,
  } = useStructureState()

  const { outerRef, railWidth, expandRail, useDrawer, contentWidth, onDragStart } = useFamilyRail({
    minContentWidth: MIN_CONTENT_WIDTH,
    enabled: !isLoading && !isMobile,
  })

  useEffect(() => {
    if (!isLoading && !isMobile) expandRail(PREFERRED_CONTENT_WIDTH)
  }, [isLoading, isMobile, expandRail])

  // Stored as a value, so setState needs the updater form to not call it
  const handleExporterChange = useCallback(
    (exporter: ModelExporter | null) => setExportModelPng(() => exporter),
    [],
  )

  const symbol = selected?.symbol ?? selected?.gene_id ?? "structure"
  const { exportSvg, exportPng } = figureExportHandlers(() =>
    svgRef.current ? new XMLSerializer().serializeToString(svgRef.current) : null,
  )
  const exportItems = [
    { label: "Topology SVG", onClick: () => exportSvg(`slc_topology_${symbol}.svg`) },
    { label: "Topology PNG", onClick: () => exportPng(`slc_topology_${symbol}.png`) },
    ...(exportModelPng
      ? [{ label: "3D model PNG", onClick: () => void exportModelPng(`slc_model_${symbol}.png`) }]
      : []),
  ]

  const paneWidth = contentWidth - CONTENT_PADDING_PX
  const sideBySide = !isMobile && paneWidth >= SIDE_BY_SIDE_MIN_WIDTH
  const figureWidth = sideBySide ? (paneWidth - COLUMN_GAP) * TOPOLOGY_FRACTION : paneWidth
  const trackWidth = Math.max(figureWidth, TRACK.minWidth)

  const topology = useTopologyState(
    features ?? [],
    selected?.uniprot_length ?? 0,
    trackWidth,
    plddt,
  )

  const header = (
    <ViewHeader
      title="Structure"
      subtitle="AlphaFold models, membrane topology, and experimental structures for each SLC"
    />
  )

  if (!available) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
        {header}
        <Alert severity="info">
          This dataset was built without structure data. Run the pipeline without
          <code> --skip-structure</code> to add it.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      {header}

      <Box ref={outerRef} sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <FamilyRail
          genes={genes}
          familyFilter={familyFilter}
          onSelectFamily={setFamilyFilter}
          railWidth={railWidth}
          useDrawer={isMobile || useDrawer}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
          onDragStart={onDragStart}
        />

        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <StructureToolbar
            genes={genes}
            showTreeButton={isMobile || useDrawer}
            familyFilter={familyFilter}
            onOpenTree={() => setDrawerOpen(true)}
            counterText={counterText}
            onResetView={() => {
              setSelectedGeneId(null)
              setFamilyFilter(null)
            }}
            exportItems={exportItems}
          />
          <Divider />

          <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
            <ViewStatus
              error={error}
              loading={isLoading}
              errorMessage="Failed to load structure data."
            >
              <Box sx={{ height: "100%", overflowY: "auto", p: 2 }}>
                {selected ? (
                  <Stack spacing={3}>
                    <IdentityCard structure={selected} gene={selectedGene} />

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
                        data-testid="topology-column"
                        sx={{ flex: sideBySide ? "6 1 0" : "none", minWidth: 0, overflowX: "auto" }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="overline" color="primary">
                            Membrane topology
                          </Typography>
                          <InfoPopover label="How to read the topology diagram">
                            <Typography variant="body2">
                              The line is the protein chain, drawn left to right from the N- to the
                              C-terminus along the residue axis. Solid cylinders are transmembrane
                              helices, numbered in order; half-height paler ones dip into the
                              membrane and leave on the side they entered. The band behind them is
                              the membrane, named beneath the figure. The chain loops out above or
                              below depending on which face that stretch sits on, so you can follow
                              how it threads through; a dashed stretch is one whose face
                              UniProt&apos;s own annotation leaves unresolved.
                            </Typography>
                            <Typography variant="body2">
                              Bars mark the residues that bind a ligand, one row per site, drawn to
                              the width of the annotation. The strip underneath is AlphaFold&apos;s
                              per-residue confidence (pLDDT), deeper colour meaning a more reliable
                              prediction; hover it for the score at any residue. It is absent when
                              the model is of a different sequence version than the annotation.
                            </Typography>
                            <Typography variant="body2">
                              The ruler at the bottom is the amino-acid position along the protein,
                              counted from the N-terminus. It is the horizontal scale for everything
                              above it, which is what the faint vertical lines mark.
                            </Typography>
                          </InfoPopover>
                        </Stack>
                        {features?.length && selected.uniprot_length ? (
                          <TopologyFigure
                            svgRef={svgRef}
                            length={selected.uniprot_length}
                            plddt={plddt}
                            topology={topology}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            UniProt has no topology annotation for this protein.
                          </Typography>
                        )}
                      </Box>

                      <Box
                        data-testid="model-column"
                        sx={{ flex: sideBySide ? "4 1 0" : "none", minWidth: 0 }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="overline" color="primary">
                            3D model
                          </Typography>
                          <InfoPopover label="How to read the 3D model">
                            <Typography variant="body2">
                              The predicted model opens first, coloured by AlphaFold&apos;s
                              per-residue confidence: the same score the strip under the topology
                              figure shows. Every gene has one, and its residue numbering matches
                              the figure exactly.
                            </Typography>
                            <Typography variant="body2">
                              Drag to rotate, scroll to zoom. Experimental structures, where they
                              exist, are listed below and open in this panel; they are measured
                              rather than predicted, but often cover only part of the chain and are
                              numbered in their own residues.
                            </Typography>
                          </InfoPopover>
                        </Stack>
                        <ModelViewerPanel
                          source={modelSource}
                          deferLoad={isMobile}
                          highlightSpans={topology.highlightSpans}
                          focusedSpans={topology.focusSpans}
                          onExporterChange={handleExporterChange}
                        />
                        <Stack spacing={1} sx={{ mt: 1 }}>
                          {experimental && experimental.length > 0 && (
                            <ModelSwitcher
                              entries={experimental}
                              selectedPdbId={selectedPdbId}
                              onSelect={selectPdbId}
                            />
                          )}
                          <LinkedResidues
                            highlightSpans={topology.highlightSpans}
                            focusedSpans={topology.focusSpans}
                            linkable={modelSource?.kind === "afdb"}
                          />
                        </Stack>
                      </Box>
                    </Box>

                    <ModelCaveats structure={selected} />

                    {experimental && experimental.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Experimental structures ({experimental.length})
                        </Typography>
                        <ExperimentalTable
                          entries={experimental}
                          selectedPdbId={selectedPdbId}
                          onSelect={selectPdbId}
                        />
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <StructureSummary structures={structures ?? []} />
                )}
              </Box>
            </ViewStatus>
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
