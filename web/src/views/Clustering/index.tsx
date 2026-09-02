// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react"
import SearchIcon from "@mui/icons-material/Search"
import { Box, Divider, Paper, useMediaQuery, useTheme } from "@mui/material"
import { AXIS_SCALE } from "@/api/hooks/useClustering"
import { downloadGeneTreeNewick } from "@/api/newick"
import GeneSearchPanel from "@/components/autocomplete/GeneSearchPanel"
import FloatingToggleButton from "@/components/FloatingToggleButton"
import {
  CORNER_BUTTON_LEFT,
  CORNER_BUTTON_TOP,
  CORNER_BUTTON_TOP_CLEAR,
} from "@/components/heatmap/constants"
import HeatmapCornerButton from "@/components/heatmap/HeatmapCornerButton"
import FloatingSurface, { searchSurfaceSx } from "@/components/view/FloatingSurface"
import ViewStatus from "@/components/view/ViewStatus"
import { downloadName } from "@/utils/download"
import { useShareParam } from "@/utils/useShareParam"
import ClusteringToolbar from "./ClusteringToolbar"
import LayoutToggle from "./LayoutToggle"
import { AXIS_H } from "./PhyloAxis"
import PhyloTree, { type PhyloTreeHandle } from "./PhyloTree"
import { ROW_H_DEFAULT } from "./phyloLayout"
import { LAYOUT_PARAM } from "./shareParams"
import SpacingSettings from "./SpacingSettings"
import { useClusteringState } from "./useClusteringState"

const SPACING_FLOAT_TOP = AXIS_H + CORNER_BUTTON_LEFT

export default function Clustering() {
  const [layout, setLayout] = useShareParam(LAYOUT_PARAM)
  const [rowH, setRowH] = useState(ROW_H_DEFAULT)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchCoversContent, setSearchCoversContent] = useState(false)
  const [cornerNearAxis, setCornerNearAxis] = useState(false)
  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"))
  const searchFloats = isMobile || searchCoversContent
  const settingsFloats = searchFloats
  const treeRef = useRef<PhyloTreeHandle>(null)

  const {
    data,
    isLoading,
    error,
    geneById,
    families,
    genes,
    leafCount,
    familyFilter,
    setFamilyFilter,
    selectedGeneId,
    setSelectedGeneId,
    metric,
    setMetric,
    tissue,
    setTissue,
    method,
  } = useClusteringState()

  useEffect(() => {
    if (familyFilter) treeRef.current?.focusFamily(familyFilter)
  }, [familyFilter, data])

  const filenameBase = downloadName(`${method}_${layout}`)
  const exportItems = [
    { label: "Gene tree SVG", onClick: () => treeRef.current?.exportSvg(`${filenameBase}.svg`) },
    { label: "Gene tree PNG", onClick: () => treeRef.current?.exportPng(`${filenameBase}.png`) },
    {
      label: "Gene tree Newick",
      onClick: () => downloadGeneTreeNewick(method, downloadName(`${method}.nwk`)),
    },
  ]

  const searchPanel = (
    <GeneSearchPanel
      families={families}
      genes={genes}
      familyFilter={familyFilter}
      onFamilyChange={setFamilyFilter}
      selectedGeneId={selectedGeneId}
      onGeneChange={(g) => {
        setSelectedGeneId(g?.id ?? null)
        if (g) treeRef.current?.focusGene(g.id)
      }}
    />
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Paper
        variant="outlined"
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        <ClusteringToolbar
          metric={metric}
          onMetricChange={setMetric}
          tissue={tissue}
          onTissueChange={setTissue}
          leafCount={leafCount}
          onResetView={() => treeRef.current?.resetView()}
          exportItems={exportItems}
        />
        <Divider />

        <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
          <ViewStatus
            error={error}
            loading={isLoading || !data}
            errorMessage="Failed to load clustering data."
          >
            <PhyloTree
              ref={treeRef}
              data={data!}
              layout={layout}
              rowH={rowH}
              axisScale={AXIS_SCALE[method]}
              familyFilter={familyFilter}
              selectedGeneId={selectedGeneId}
              onSelect={setSelectedGeneId}
              geneById={geneById}
              onSearchCoversContentChange={setSearchCoversContent}
              onCornerNearAxisChange={setCornerNearAxis}
            />

            {layout === "rectangular" &&
              (settingsFloats ? (
                <HeatmapCornerButton
                  topOffset={cornerNearAxis ? SPACING_FLOAT_TOP : CORNER_BUTTON_TOP_CLEAR}
                >
                  <SpacingSettings
                    rowH={rowH}
                    onRowHChange={setRowH}
                    onReset={() => setRowH(ROW_H_DEFAULT)}
                  />
                </HeatmapCornerButton>
              ) : (
                <Box
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  sx={{
                    position: "absolute",
                    left: 12,
                    top: CORNER_BUTTON_TOP,
                    zIndex: 4,
                    width: searchSurfaceSx.width,
                    bgcolor: "background.paper",
                    borderRadius: 1,
                    pl: 1.5,
                    pt: 0.5,
                  }}
                >
                  <SpacingSettings
                    rowH={rowH}
                    onRowHChange={setRowH}
                    onReset={() => setRowH(ROW_H_DEFAULT)}
                  />
                </Box>
              ))}

            {!searchFloats && (
              <FloatingSurface sx={{ top: 12, left: 12, zIndex: 2, ...searchSurfaceSx }}>
                {searchPanel}
              </FloatingSurface>
            )}

            {searchFloats && (
              <>
                {searchOpen && (
                  <FloatingSurface sx={{ bottom: 64, right: 12, zIndex: 2, ...searchSurfaceSx }}>
                    {searchPanel}
                  </FloatingSurface>
                )}
                <FloatingToggleButton
                  open={searchOpen}
                  onToggle={() => setSearchOpen((v) => !v)}
                  icon={<SearchIcon fontSize="small" />}
                  title="Find gene"
                  openTitle="Close search"
                  sx={{ bottom: 12, right: 12, zIndex: 2 }}
                />
              </>
            )}

            <LayoutToggle layout={layout} onChange={setLayout} />
          </ViewStatus>
        </Box>
      </Paper>
    </Box>
  )
}
