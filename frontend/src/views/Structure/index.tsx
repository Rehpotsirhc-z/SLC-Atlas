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
import InfoTooltip from "@/components/InfoTooltip"
import FamilyRail from "@/components/view/FamilyRail"
import { useFamilyRail } from "@/components/view/useFamilyRail"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { capBoxSx } from "@/theme"
import { figureExportHandlers } from "@/utils/exportFigure"
import { useElementSize } from "@/utils/useElementSize"
import {
  COLUMN_GAP,
  CONTENT_PADDING_PX,
  MIN_CONTENT_WIDTH,
  PREFERRED_CONTENT_WIDTH,
  SIDE_BY_SIDE_MIN_WIDTH,
  TRACK,
} from "./constants"
import ExperimentalTable from "./ExperimentalTable"
import IdentityCard from "./IdentityCard"
import LinkedResidues from "./LinkedResidues"
import ModelLinks from "./ModelLinks"
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

  const [figureRef, figureBox] = useElementSize<HTMLDivElement>("content")

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
  // Floored so a fractional column width cannot leave the figure a sub-pixel too wide
  const trackWidth = Math.max(Math.floor(figureBox.w), TRACK.minWidth)

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
                        ref={figureRef}
                        data-testid="topology-column"
                        sx={{ flex: sideBySide ? "6 1 0" : "none", minWidth: 0, overflowX: "auto" }}
                      >
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="overline" color="primary" sx={capBoxSx}>
                            Membrane topology
                          </Typography>
                          <InfoTooltip label="How to read the topology diagram">
                            <Typography variant="caption" component="p">
                              The x axis is the residue number, so every mark sits at the residues
                              it covers and a helix is as wide as it is long. The curve threading
                              the figure is the protein chain, N-terminus at left. The solid
                              cylinders in the membrane band are transmembrane helices, numbered in
                              order; the paler, half-height cylinders sit inside the membrane
                              without crossing it. Between cylinders the chain loops onto whichever
                              side of the membrane UniProt puts that stretch on, drawn dashed where
                              UniProt leaves the side undetermined.
                            </Typography>
                            <Typography variant="caption" component="p">
                              Each row under Binds is one binding site; the blocks in it are the
                              residues that touch the ligand named in the key below. The Confidence
                              strip is AlphaFold&apos;s per-residue score, banded in the same four
                              colours as the 3D model; hover it for the score at a residue.
                            </Typography>
                          </InfoTooltip>
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
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                          <Typography variant="overline" color="primary" sx={capBoxSx}>
                            3D model
                          </Typography>
                          <InfoTooltip label="How to read the 3D model">
                            <Typography variant="caption" component="p">
                              The predicted model opens first, coloured by AlphaFold&apos;s
                              per-residue confidence: the same score, in the same colours, as the
                              Confidence strip under the topology figure. Every gene has one, and
                              its residue numbering matches the figure exactly.
                            </Typography>
                            <Typography variant="caption" component="p">
                              Drag to rotate, scroll to zoom. Experimental structures, where they
                              exist, are listed below and open in this panel; they are measured
                              rather than predicted, but often cover only part of the chain and are
                              numbered in their own residues.
                            </Typography>
                          </InfoTooltip>
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

                    <ModelLinks structure={selected} />

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
