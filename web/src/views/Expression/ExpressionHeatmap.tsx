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
import type { ExpressionRow } from "@/types/expression"
import type { Gene } from "@/types/gene"
import ExpressionHoverTip from "./ExpressionHoverTip"
import TissueColumnHeader from "./TissueColumnHeader"
import TissueFlashOverlay from "./TissueFlashOverlay"
import { useExpressionHeatmapState } from "./useExpressionHeatmapState"

export interface ExpressionHeatmapHandle {
  resetView: () => void
  focusGene: (geneId: string) => void
  focusFamily: (family: string) => void
  focusTissue: (tissue: string | string[]) => void
  exportSvg: (filename: string) => void
  exportPng: (filename: string) => void
}

interface ExpressionHeatmapProps {
  rows: ExpressionRow[]
  clusterNodes: ClusterNode[]
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
  cornerSlot?: React.ReactNode
  searchInCorner: boolean
  onSearchCoversContentChange?: (covers: boolean) => void
  onTissueClick?: (tissue: string) => void
  showGeneTree?: boolean
  onToggleGeneTree?: () => void
  legendSlot?: React.ReactNode
}

const ExpressionHeatmap = forwardRef<ExpressionHeatmapHandle, ExpressionHeatmapProps>(
  function ExpressionHeatmap(
    {
      rows,
      clusterNodes,
      familyFilter,
      selectedGeneId,
      onSelect,
      geneById,
      cornerSlot,
      searchInCorner,
      onSearchCoversContentChange,
      onTissueClick,
      showGeneTree = true,
      onToggleGeneTree,
      legendSlot,
    },
    ref,
  ) {
    const h = useExpressionHeatmapState({
      rows,
      clusterNodes,
      familyFilter,
      selectedGeneId,
      onSelect,
      geneById,
      showGeneTree,
      hasLegend: !!legendSlot,
    })

    useImperativeHandle(
      ref,
      () => ({
        resetView: h.resetView,
        focusGene: h.focusGene,
        focusFamily: h.focusFamily,
        focusTissue: h.focusTissue,
        ...figureExportHandlers(h.buildFigure),
      }),
      [h.resetView, h.focusGene, h.focusFamily, h.focusTissue, h.buildFigure],
    )

    useEffect(() => {
      onSearchCoversContentChange?.(h.searchCoversContent)
    }, [h.searchCoversContent, onSearchCoversContentChange])

    if (!h.geneTree || h.geneRows.length === 0 || h.tissueCols.length === 0) {
      return (
        <Box
          sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Typography color="text.secondary">No expression data to display.</Typography>
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
            <TissueColumnHeader
              tissueCols={h.tissueCols}
              cellW={h.cellW}
              gridW={h.gridW}
              topH={h.topH}
              font={h.tissueFont}
              onTissueClick={onTissueClick}
            />
          }
          showGeneTree={showGeneTree}
          onToggleGeneTree={onToggleGeneTree}
          showLegend={h.showLegend}
          legendSlot={legendSlot}
          headerH={h.headerH}
          containerH={h.containerH}
          overlay={h.hover ? <ExpressionHoverTip hover={h.hover} monoFont={h.monoFont} /> : null}
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
            selectedZIndex={2}
            onHover={h.onHover}
            onCellClick={h.toggleCell}
          >
            <TissueFlashOverlay
              spans={h.flashSpans}
              cellW={h.cellW}
              gridH={h.gridH}
              reduceMotion={h.reduceMotion}
            />
          </MatrixCanvas>
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

export default ExpressionHeatmap
