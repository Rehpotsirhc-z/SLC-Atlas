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
import FamilyRail from "@/components/view/FamilyRail"
import { useFamilyRail } from "@/components/view/useFamilyRail"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { figureExportHandlers } from "@/utils/exportFigure"
import {
  CONTENT_PADDING_PX,
  MIN_CONTENT_WIDTH,
  PREFERRED_CONTENT_WIDTH,
  SIDE_BY_SIDE_MIN_WIDTH,
} from "./constants"
import ExperimentalTable from "./ExperimentalTable"
import IdentityCard from "./IdentityCard"
import ModelLinks from "./ModelLinks"
import StructureSummary from "./StructureSummary"
import StructureToolbar from "./StructureToolbar"
import LinkedPanes from "./LinkedPanes"
import { useStructureState } from "./useStructureState"
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
    modelOptions,
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

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

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
          onDrawerClose={closeDrawer}
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

                    <LinkedPanes
                      structure={selected}
                      features={features}
                      plddt={plddt}
                      modelSource={modelSource}
                      modelOptions={modelOptions}
                      selectedPdbId={selectedPdbId}
                      onSelectPdbId={selectPdbId}
                      sideBySide={sideBySide}
                      isMobile={isMobile}
                      svgRef={svgRef}
                      onExporterChange={handleExporterChange}
                    />

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
