// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react"
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
import { CONTENT_PADDING_PX, MIN_CONTENT_WIDTH, PREFERRED_CONTENT_WIDTH, TRACK } from "./constants"
import ExperimentalTable from "./ExperimentalTable"
import IdentityCard from "./IdentityCard"
import ModelCaveats from "./ModelCaveats"
import StructureSummary from "./StructureSummary"
import StructureToolbar from "./StructureToolbar"
import TopologyTrack from "./TopologyTrack"
import { useStructureState } from "./useStructureState"

export default function Structure() {
  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const available = useCapability("structure")

  const {
    structures,
    genes,
    selected,
    selectedGene,
    features,
    experimental,
    isLoading,
    error,
    familyFilter,
    setFamilyFilter,
    setSelectedGeneId,
    counterText,
  } = useStructureState()

  const { outerRef, railWidth, expandRail, useDrawer, contentWidth, onDragStart } = useFamilyRail({
    minContentWidth: MIN_CONTENT_WIDTH,
    enabled: !isLoading && !isMobile,
  })

  useEffect(() => {
    if (!isLoading && !isMobile) expandRail(PREFERRED_CONTENT_WIDTH)
  }, [isLoading, isMobile, expandRail])

  const symbol = selected?.symbol ?? selected?.gene_id ?? "structure"
  const { exportSvg, exportPng } = figureExportHandlers(() =>
    svgRef.current ? new XMLSerializer().serializeToString(svgRef.current) : null,
  )
  const exportItems = [
    { label: "Topology SVG", onClick: () => exportSvg(`slc_topology_${symbol}.svg`) },
    { label: "Topology PNG", onClick: () => exportPng(`slc_topology_${symbol}.png`) },
  ]

  const trackWidth = Math.max(contentWidth - CONTENT_PADDING_PX, TRACK.minWidth)

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

                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Membrane topology
                      </Typography>
                      {features?.length && selected.uniprot_length ? (
                        <TopologyTrack
                          svgRef={svgRef}
                          features={features}
                          length={selected.uniprot_length}
                          width={trackWidth}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          UniProt has no topology annotation for this protein.
                        </Typography>
                      )}
                    </Box>

                    <ModelCaveats structure={selected} />

                    {experimental && experimental.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Experimental structures ({experimental.length})
                        </Typography>
                        <ExperimentalTable entries={experimental} />
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
