// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef, useState } from "react"
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew"
import SearchIcon from "@mui/icons-material/Search"
import { Box, Divider, Paper, useMediaQuery, useTheme } from "@mui/material"
import { downloadGeneTreeNewick } from "@/api/newick"
import GeneSearchPanel from "@/components/autocomplete/GeneSearchPanel"
import FloatingToggleButton from "@/components/FloatingToggleButton"
import FloatingSurface, { searchSurfaceSx } from "@/components/view/FloatingSurface"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { downloadName } from "@/utils/download"
import AnatomogramDock from "./AnatomogramDock"
import ExpressionHeatmap, { type ExpressionHeatmapHandle } from "./ExpressionHeatmap"
import ExpressionLegend from "./ExpressionLegend"
import ExpressionToolbar from "./ExpressionToolbar"
import GeneOrderSelect from "./GeneOrderSelect"
import { useExpressionRail } from "./useExpressionRail"
import { useExpressionState } from "./useExpressionState"

export default function Expression() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [showGeneTree, setShowGeneTree] = useState(true)
  const heatmapRef = useRef<ExpressionHeatmapHandle>(null)
  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"))

  const {
    rows,
    clusterNodes,
    geneById,
    selectedInfo,
    isLoading,
    error,
    ready,
    families,
    genes,
    presentTissues,
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
  } = useExpressionState()

  const focusTissue = useCallback((tissues: string[]) => {
    heatmapRef.current?.focusTissue(tissues)
  }, [])

  const rail = useExpressionRail({
    tissue,
    selectedRows: selectedInfo?.rows ?? null,
    onFocusTissue: focusTissue,
  })

  const exportItems = [
    {
      label: "Heatmap SVG",
      onClick: () => heatmapRef.current?.exportSvg(downloadName(`expression_${tissue}.svg`)),
    },
    {
      label: "Heatmap PNG",
      onClick: () => heatmapRef.current?.exportPng(downloadName(`expression_${tissue}.png`)),
    },
    {
      label: "Gene tree Newick",
      onClick: () => downloadGeneTreeNewick(method, downloadName("expression_gene_tree.nwk")),
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
      <ViewHeader title="Expression" subtitle="RNA abundance across tissues" />

      <Paper
        variant="outlined"
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        <ExpressionToolbar
          tissue={tissue}
          onTissueChange={setTissue}
          counterText={counterText}
          onResetView={() => heatmapRef.current?.resetView()}
          exportItems={exportItems}
        />
        <Divider />

        <Box
          ref={rail.rowRef}
          sx={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}
        >
          <Box sx={{ flex: 1, position: "relative", minHeight: 0, minWidth: 0 }}>
            <ViewStatus
              error={error}
              loading={isLoading || !ready}
              errorMessage="Failed to load expression data."
            >
              <ExpressionHeatmap
                ref={heatmapRef}
                rows={rows!}
                clusterNodes={clusterNodes!}
                familyFilter={familyFilter}
                selectedGeneId={selectedGeneId}
                onSelect={setSelectedGeneId}
                geneById={geneById}
                cornerSlot={<GeneOrderSelect metric={metric} onChange={setMetric} />}
                onTissueClick={(t) => rail.pickTissue([t])}
                showGeneTree={showGeneTree}
                onToggleGeneTree={() => setShowGeneTree((v) => !v)}
                legendSlot={<ExpressionLegend rows={rows ?? []} />}
              />

              {!isMobile && (
                <FloatingSurface sx={{ top: 12, left: 12, zIndex: 4, ...searchSurfaceSx }}>
                  {searchPanel}
                </FloatingSurface>
              )}

              {isMobile && (
                <>
                  <FloatingToggleButton
                    open={rail.railOpen}
                    onToggle={() => rail.setRailOpen(!rail.railOpen)}
                    icon={<AccessibilityNewIcon fontSize="small" />}
                    title="Show anatomograms"
                    openTitle="Hide anatomograms"
                    sx={{ bottom: 12, right: 64, zIndex: 4 }}
                  />
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

          <AnatomogramDock
            rail={rail}
            presentTissues={presentTissues}
            isMobile={isMobile}
            onScopeAll={() => setTissue("all")}
            onScopeBrain={() => setTissue("brain")}
          />
        </Box>
      </Paper>
    </Box>
  )
}
