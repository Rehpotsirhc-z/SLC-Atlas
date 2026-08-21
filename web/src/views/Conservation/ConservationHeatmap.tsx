// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, useEffect, useImperativeHandle } from "react"
import { Box, Typography } from "@mui/material"
import CellSizeSliders from "@/components/heatmap/CellSizeSliders"
import { CORNER_BUTTON_TOP, CORNER_BUTTON_TOP_CLEAR } from "@/components/heatmap/constants"
import GeneSidebar from "@/components/heatmap/GeneSidebar"
import HeatmapCornerButton from "@/components/heatmap/HeatmapCornerButton"
import HeatmapShell from "@/components/heatmap/HeatmapShell"
import MatrixCanvas from "@/components/heatmap/MatrixCanvas"
import { figureExportHandlers } from "@/utils/exportFigure"
import type { ClusterNode } from "@/types/clustering"
import type { ConservationCell, SpeciesNode } from "@/types/conservation"
import type { CellMetricKey } from "@/types/conservation"
import type { Gene } from "@/types/gene"
import ConservationHoverTip from "./ConservationHoverTip"
import SpeciesHeader from "./SpeciesHeader"
import { useConservationMatrix } from "./useConservationMatrix"

export interface ConservationHeatmapHandle {
  resetView: () => void
  focusGene: (geneId: string) => void
  focusFamily: (family: string) => void
  exportSvg: (filename: string) => void
  exportPng: (filename: string) => void
}

interface ConservationHeatmapProps {
  cells: ConservationCell[]
  clusterNodes: ClusterNode[]
  speciesNodes: SpeciesNode[]
  metric: CellMetricKey
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
  cornerSlot?: React.ReactNode
  searchInCorner: boolean
  onSearchCoversContentChange?: (covers: boolean) => void
  showSpeciesTree?: boolean
  onToggleSpeciesTree?: () => void
  showGeneTree?: boolean
  onToggleGeneTree?: () => void
  legendSlot?: React.ReactNode
}

const ConservationHeatmap = forwardRef<ConservationHeatmapHandle, ConservationHeatmapProps>(
  function ConservationHeatmap(
    {
      cells,
      clusterNodes,
      speciesNodes,
      metric,
      familyFilter,
      selectedGeneId,
      onSelect,
      geneById,
      cornerSlot,
      searchInCorner,
      onSearchCoversContentChange,
      showSpeciesTree = true,
      onToggleSpeciesTree,
      showGeneTree = true,
      onToggleGeneTree,
      legendSlot,
    },
    ref,
  ) {
    const h = useConservationMatrix({
      cells,
      clusterNodes,
      speciesNodes,
      metric,
      familyFilter,
      selectedGeneId,
      onSelect,
      geneById,
      showSpeciesTree,
      showGeneTree,
      hasLegend: !!legendSlot,
      searchInCorner,
    })

    useImperativeHandle(
      ref,
      () => ({
        resetView: h.resetView,
        focusGene: h.focusGene,
        focusFamily: h.focusFamily,
        ...figureExportHandlers(h.buildFigure),
      }),
      [h.resetView, h.focusGene, h.focusFamily, h.buildFigure],
    )

    useEffect(() => {
      onSearchCoversContentChange?.(h.searchCoversContent)
    }, [h.searchCoversContent, onSearchCoversContentChange])

    if (!h.geneTree || !h.speciesTree || h.geneRows.length === 0 || h.speciesCols.length === 0) {
      return (
        <Box
          sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Typography color="text.secondary">No conservation data to display.</Typography>
        </Box>
      )
    }

    const cellControls = (
      <CellSizeSliders
        width={h.cellW}
        height={h.cellH}
        onWidthChange={h.setCellWidth}
        onWidthChangeCommitted={h.finishCellWidthResize}
        onHeightChange={h.setCellHeight}
        onReset={h.resetCellSize}
      />
    )
    const collapsed = h.cornerCollapsed

    return (
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        <HeatmapShell
          containerRef={h.containerRef}
          headerRef={h.headerRef}
          contentW={h.contentW}
          fits={h.fits}
          contentOffsetLeft={h.contentOffsetLeft}
          leftColW={h.leftColW}
          cornerSlot={
            collapsed ? undefined : (
              <>
                {cornerSlot}
                {cellControls}
              </>
            )
          }
          headerSlot={
            <SpeciesHeader
              speciesTree={h.speciesTree}
              speciesCols={h.speciesCols}
              gridW={h.gridW}
              cellW={h.cellW}
              font={h.speciesFont}
              labelH={h.speciesLabelH}
              fits={h.fits}
              containerW={h.containerW}
              leftColW={h.leftColW}
              showSpeciesTree={showSpeciesTree}
              onToggleSpeciesTree={onToggleSpeciesTree}
            />
          }
          showGeneTree={showGeneTree}
          onToggleGeneTree={onToggleGeneTree}
          showLegend={h.showLegend}
          legendSlot={legendSlot}
          headerH={h.headerH}
          containerH={h.containerH}
          overlay={
            h.hover ? (
              <ConservationHoverTip
                hover={h.hover}
                metricLabel={h.metricLabel}
                monoFont={h.monoFont}
              />
            ) : null
          }
          onPointerLeave={h.clearHover}
          onBackgroundClick={() => h.pickGene(null)}
          sidebar={
            <GeneSidebar
              geneTree={h.geneTree}
              geneRows={h.geneRows}
              familyFilter={familyFilter}
              selectedGeneId={selectedGeneId}
              selectedRow={h.selectedRow}
              cellH={h.cellH}
              geneFont={h.geneFont}
              geneDotR={h.geneDotR}
              labelW={h.geneLabelW}
              height={h.gridH}
              showGeneTree={showGeneTree}
              onPick={h.pickGene}
            />
          }
        >
          <MatrixCanvas
            canvasRef={h.canvasRef}
            gridW={h.gridW}
            gridH={h.gridH}
            cellW={h.cellW}
            cellH={h.cellH}
            hitTest={h.hitTest}
            hoverCell={h.hover}
            selectedCell={h.selectedOutline}
            onHover={h.onHover}
            onCellClick={h.toggleCell}
          />
        </HeatmapShell>
        {collapsed && (
          <HeatmapCornerButton
            topOffset={searchInCorner ? CORNER_BUTTON_TOP : CORNER_BUTTON_TOP_CLEAR}
          >
            {cornerSlot}
            {cellControls}
          </HeatmapCornerButton>
        )}
      </Box>
    )
  },
)

export default ConservationHeatmap
