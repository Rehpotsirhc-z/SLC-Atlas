// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react"
import { Box, Divider, Paper, Stack, Typography, useMediaQuery, useTheme } from "@mui/material"
import FamilyRail from "@/components/view/FamilyRail"
import { useFamilyRail } from "@/components/view/useFamilyRail"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { downloadName } from "@/utils/download"
import { figureExportHandlers, withBackground } from "@/utils/exportFigure"
import {
  CONTENT_PADDING_PX,
  MIN_CONTENT_WIDTH,
  PREFERRED_CONTENT_WIDTH,
  SIDE_BY_SIDE_MIN_WIDTH,
} from "./constants"
import { useShareParam } from "@/utils/useShareParam"
import ExperimentalTable from "./ExperimentalTable"
import IdentityCard from "./IdentityCard"
import StructureToolbar from "./StructureToolbar"
import TopologyWall from "./TopologyWall"
import LinkedPanes from "./LinkedPanes"
import { TOPO_PARAM } from "./shareParams"
import { useStructureState } from "./useStructureState"
import { EMPTY_WALL } from "./topologyWall"
import type { Gene } from "@/types/gene"
import type { ModelExporter } from "./molstar/types"

const NO_GENES: Gene[] = []

export default function Structure() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [topoMode, setTopoMode] = useShareParam(TOPO_PARAM)
  // Present only while the viewer is mounted, which is what gates the export menu entry
  const [exportModelPng, setExportModelPng] = useState<ModelExporter | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)

  const {
    wall,
    genes,
    hasMembrane,
    selectedHasMembrane,
    marks,
    hasSignal,
    selected,
    plddt,
    sequence,
    selectedGene,
    features,
    experimental,
    isLoading,
    error,
    familyFilter,
    setFamilyFilter,
    collapseSignal,
    resetView,
    selectGene,
    modelSource,
    modelOptions,
    selectedPdbId,
    selectPdbId,
    counterText,
  } = useStructureState()

  // The rail and the wall are the two expensive mounts, so both fill in a deferred render
  const deferredGenes = useDeferredValue(genes, NO_GENES)
  const deferredWall = useDeferredValue(wall, EMPTY_WALL)

  const { outerRef, railWidth, expandRail, useDrawer, contentWidth, onDragStart } = useFamilyRail({
    minContentWidth: MIN_CONTENT_WIDTH,
    enabled: !isLoading && !isMobile,
  })

  useEffect(() => {
    if (!isLoading && !isMobile) expandRail(PREFERRED_CONTENT_WIDTH)
  }, [isLoading, isMobile, expandRail])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const handleResetView = useCallback(() => {
    paneRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    resetView()
  }, [resetView])

  const handleExporterChange = useCallback(
    (exporter: ModelExporter | null) => setExportModelPng(() => exporter),
    [],
  )

  const symbol = selected?.symbol ?? selected?.gene_id ?? "structure"
  const { exportSvg, exportPng } = figureExportHandlers(() =>
    svgRef.current
      ? withBackground(
          new XMLSerializer().serializeToString(svgRef.current),
          theme.palette.background.paper,
        )
      : null,
  )
  const exportItems = [
    { label: "Topology SVG", onClick: () => exportSvg(downloadName(`topology_${symbol}.svg`)) },
    { label: "Topology PNG", onClick: () => exportPng(downloadName(`topology_${symbol}.png`)) },
    ...(exportModelPng
      ? [
          {
            label: "3D model PNG",
            onClick: () => void exportModelPng(downloadName(`model_${symbol}.png`)),
          },
        ]
      : []),
  ]

  const paneWidth = contentWidth - CONTENT_PADDING_PX
  const sideBySide = !isMobile && paneWidth >= SIDE_BY_SIDE_MIN_WIDTH

  const header = (
    <ViewHeader
      title="Structure"
      subtitle={`Predicted models, ${hasMembrane ? "membrane topology" : "sequence features"}, and experimental structures`}
    />
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      {header}

      <Box ref={outerRef} sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <FamilyRail
          genes={deferredGenes}
          familyFilter={familyFilter}
          onSelectFamily={setFamilyFilter}
          railWidth={railWidth}
          useDrawer={isMobile || useDrawer}
          drawerOpen={drawerOpen}
          onDrawerClose={closeDrawer}
          onDragStart={onDragStart}
          collapseSignal={collapseSignal}
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
            onSelectGene={selectGene}
            counterText={counterText}
            onResetView={handleResetView}
            exportItems={exportItems}
          />
          <Divider />

          <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
            <ViewStatus
              error={error}
              loading={isLoading}
              errorMessage="Failed to load structure data."
            >
              <Box ref={paneRef} sx={{ height: "100%", overflowY: "auto", p: 2 }}>
                {selected && (
                  <Stack spacing={3}>
                    <LinkedPanes
                      identity={
                        <IdentityCard
                          structure={selected}
                          gene={selectedGene}
                          hasMembrane={selectedHasMembrane}
                          marks={marks}
                          signal={hasSignal}
                        />
                      }
                      structure={selected}
                      features={features}
                      plddt={plddt}
                      sequence={sequence}
                      modelSource={modelSource}
                      modelOptions={modelOptions}
                      selectedPdbId={selectedPdbId}
                      onSelectPdbId={selectPdbId}
                      sideBySide={sideBySide}
                      svgRef={svgRef}
                      onExporterChange={handleExporterChange}
                      membrane={selectedHasMembrane}
                      mode={topoMode}
                      onModeChange={setTopoMode}
                    />

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
                )}
                {/* The wall stays mounted behind the detail so deselecting never rebuilds it */}
                <TopologyWall
                  wall={deferredWall}
                  familyFilter={familyFilter}
                  hidden={selected != null}
                  onSelectGene={selectGene}
                />
              </Box>
            </ViewStatus>
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
