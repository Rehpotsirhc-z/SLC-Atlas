// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react"
import SearchIcon from "@mui/icons-material/Search"
import { Box, Divider, Paper, useMediaQuery, useTheme } from "@mui/material"
import { downloadGeneTreeNewick } from "@/api/newick"
import GeneSearchPanel from "@/components/autocomplete/GeneSearchPanel"
import FloatingToggleButton from "@/components/FloatingToggleButton"
import FloatingSurface, { searchSurfaceSx } from "@/components/view/FloatingSurface"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import ClusteringToolbar from "./ClusteringToolbar"
import LayoutToggle from "./LayoutToggle"
import PhyloTree, { type Layout, type PhyloTreeHandle } from "./PhyloTree"
import { useClusteringState } from "./useClusteringState"

export default function Clustering() {
  const [layout, setLayout] = useState<Layout>("rectangular")
  const [searchOpen, setSearchOpen] = useState(false)
  const treeRef = useRef<PhyloTreeHandle>(null)
  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"))

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

  const filenameBase = `slc_${method}_${layout}`
  const exportItems = [
    { label: "Download SVG", onClick: () => treeRef.current?.exportSvg(`${filenameBase}.svg`) },
    { label: "Download PNG", onClick: () => treeRef.current?.exportPng(`${filenameBase}.png`) },
    {
      label: "Download Newick (.nwk)",
      onClick: () => downloadGeneTreeNewick(method, `slc_${method}.nwk`),
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
      <ViewHeader
        title="Clustering"
        subtitle="SLC similarity trees by amino-acid, DNA (CDS), GTEx RNA co-expression, and ortholog identity"
      />

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
              familyFilter={familyFilter}
              selectedGeneId={selectedGeneId}
              onSelect={setSelectedGeneId}
              geneById={geneById}
            />

            {!isMobile && (
              <FloatingSurface sx={{ top: 12, left: 12, zIndex: 2, ...searchSurfaceSx }}>
                {searchPanel}
              </FloatingSurface>
            )}

            {isMobile && (
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
