// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from "react"
import SearchIcon from "@mui/icons-material/Search"
import { Box, Divider, Paper, useMediaQuery, useTheme } from "@mui/material"
import { downloadGeneTreeNewick, downloadSpeciesTreeNewick } from "@/api/newick"
import GeneSearchPanel from "@/components/autocomplete/GeneSearchPanel"
import FloatingToggleButton from "@/components/FloatingToggleButton"
import FloatingSurface, { searchSurfaceSx } from "@/components/view/FloatingSurface"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { useDeferredReady } from "@/utils/useDeferredReady"
import { downloadName } from "@/utils/download"
import { GENETREE_PARAM } from "@/utils/shareParams"
import { useShareParam } from "@/utils/useShareParam"
import ConservationHeatmap, { type ConservationHeatmapHandle } from "./ConservationHeatmap"
import ConservationLegend from "./ConservationLegend"
import ConservationToolbar from "./ConservationToolbar"
import GeneOrderControl from "./GeneOrderControl"
import { CELL_PARAM, SPECIESTREE_PARAM } from "./shareParams"
import { useConservationState } from "./useConservationState"

export default function Conservation() {
  const [cellMetric, setCellMetric] = useShareParam(CELL_PARAM)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchCoversContent, setSearchCoversContent] = useState(false)
  const [showSpeciesTree, setShowSpeciesTree] = useShareParam(SPECIESTREE_PARAM)
  const [showGeneTree, setShowGeneTree] = useShareParam(GENETREE_PARAM)
  const heatmapRef = useRef<ConservationHeatmapHandle>(null)
  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"))
  const searchFloats = isMobile || searchCoversContent

  const {
    cells,
    speciesNodes,
    clusterNodes,
    geneById,
    isLoading,
    error,
    ready,
    families,
    genes,
    counterText,
    familyFilter,
    setFamilyFilter,
    selectedGeneId,
    setSelectedGeneId,
    metric,
    setMetric,
    tissue,
    setTissue,
    method,
  } = useConservationState(cellMetric)

  const deferredReady = useDeferredReady()

  const exportItems = [
    {
      label: "Heatmap SVG",
      onClick: () => heatmapRef.current?.exportSvg(downloadName(`conservation_${cellMetric}.svg`)),
    },
    {
      label: "Heatmap PNG",
      onClick: () => heatmapRef.current?.exportPng(downloadName(`conservation_${cellMetric}.png`)),
    },
    {
      label: "Gene tree Newick",
      onClick: () => downloadGeneTreeNewick(method, downloadName("gene_tree.nwk")),
    },
    {
      label: "Species tree Newick",
      onClick: () => downloadSpeciesTreeNewick(downloadName("species_tree.nwk")),
    },
  ]

  const searchPanel = (
    <GeneSearchPanel
      families={families}
      genes={genes}
      familyFilter={familyFilter}
      onFamilyChange={(f) => {
        setFamilyFilter(f)
        if (f) heatmapRef.current?.focusFamily(f)
      }}
      selectedGeneId={selectedGeneId}
      onGeneChange={(g) => {
        setSelectedGeneId(g?.id ?? null)
        if (g) heatmapRef.current?.focusGene(g.id)
      }}
    />
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <ViewHeader title="Conservation" subtitle="Ortholog sequence conservation across species" />

      <Paper
        variant="outlined"
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        <ConservationToolbar
          cellMetric={cellMetric}
          onCellMetricChange={setCellMetric}
          counterText={counterText}
          onResetView={() => heatmapRef.current?.resetView()}
          exportItems={exportItems}
        />
        <Divider />

        <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
          <ViewStatus
            error={error}
            loading={isLoading || !ready || !deferredReady}
            errorMessage="Failed to load conservation data."
          >
            <ConservationHeatmap
              ref={heatmapRef}
              cells={cells!}
              clusterNodes={clusterNodes!}
              speciesNodes={speciesNodes!}
              metric={cellMetric}
              familyFilter={familyFilter}
              selectedGeneId={selectedGeneId}
              onSelect={setSelectedGeneId}
              geneById={geneById}
              cornerSlot={
                <GeneOrderControl
                  metric={metric}
                  onMetricChange={setMetric}
                  tissue={tissue}
                  onTissueChange={setTissue}
                />
              }
              searchInCorner={!searchFloats}
              onSearchCoversContentChange={setSearchCoversContent}
              showSpeciesTree={showSpeciesTree}
              onToggleSpeciesTree={() => setShowSpeciesTree((v) => !v)}
              showGeneTree={showGeneTree}
              onToggleGeneTree={() => setShowGeneTree((v) => !v)}
              legendSlot={<ConservationLegend metric={cellMetric} />}
            />

            {!searchFloats && (
              <FloatingSurface sx={{ top: 12, left: 12, zIndex: 4, ...searchSurfaceSx }}>
                {searchPanel}
              </FloatingSurface>
            )}

            {searchFloats && (
              <>
                {searchOpen && (
                  <FloatingSurface sx={{ bottom: 64, right: 12, zIndex: 4, ...searchSurfaceSx }}>
                    {searchPanel}
                  </FloatingSurface>
                )}
                <FloatingToggleButton
                  open={searchOpen}
                  onToggle={() => setSearchOpen((v) => !v)}
                  icon={<SearchIcon fontSize="small" />}
                  title="Find gene"
                  openTitle="Close search"
                  sx={{ bottom: 12, right: 12, zIndex: 4 }}
                />
              </>
            )}
          </ViewStatus>
        </Box>
      </Paper>
    </Box>
  )
}
