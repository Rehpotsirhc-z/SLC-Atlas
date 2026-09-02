// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Alert, Box, Divider, Paper, TablePagination, useMediaQuery, useTheme } from "@mui/material"
import FamilyRail from "@/components/view/FamilyRail"
import { useFamilyRail } from "@/components/view/useFamilyRail"
import { useUIStore } from "@/store/uiStore"
import { useDeferredReady } from "@/utils/useDeferredReady"
import { MIN_CONTENT_WIDTH } from "./constants"
import GeneAnnotationToolbar from "./GeneAnnotationToolbar"
import { downloadGenes } from "./geneDownloads"
import GeneTable from "./GeneTable"
import GeneTableSkeleton from "./GeneTableSkeleton"
import { MapViewportWidthContext } from "./mapWidthContext"
import { useGeneAnnotationState } from "./useGeneAnnotationState"
import { ROWS_PER_PAGE_OPTIONS } from "./shareParams"

export default function GeneAnnotation() {
  const {
    genes,
    isLoading,
    error,
    visibleGenes,
    searchText,
    setSearchText,
    familyFilter,
    setFamilyFilter,
    sortKey,
    sortDirection,
    toggleSort,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    expandedGeneIds,
    toggleExpanded,
    resetView,
  } = useGeneAnnotationState()

  const paginatedGenes = visibleGenes.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
  const deferredReady = useDeferredReady()
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [scrollViewportWidth, setScrollViewportWidth] = useState(0)

  const jumpedGeneIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedGeneId || jumpedGeneIdRef.current === selectedGeneId) return
    const geneIndex = visibleGenes.findIndex((gene) => gene.id === selectedGeneId)
    if (geneIndex === -1) return
    jumpedGeneIdRef.current = selectedGeneId
    setPage(Math.floor(geneIndex / rowsPerPage))
  }, [selectedGeneId, visibleGenes, rowsPerPage, setPage])

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [drawerOpen, setDrawerOpen] = useState(false)

  const { outerRef, railWidth, expandRail, useDrawer, onDragStart } = useFamilyRail({
    minContentWidth: MIN_CONTENT_WIDTH,
    enabled: !isLoading && !isMobile,
  })

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const handleResetView = useCallback(() => {
    tableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    resetView()
  }, [resetView])

  useLayoutEffect(() => {
    if (isLoading || !deferredReady) return
    const el = tableScrollRef.current
    const table = el?.querySelector<HTMLElement>("table")
    if (!el || !table) return
    // Temporarily clear width to measure the table's natural minimum content width
    const prev = table.style.width
    table.style.width = "auto"
    const naturalWidth = table.offsetWidth
    table.style.width = prev
    table.style.minWidth = `${naturalWidth}px`
    expandRail(naturalWidth)
  }, [isLoading, deferredReady, expandRail])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    const measure = () => setScrollViewportWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isLoading, error])

  const exportItems = [
    { label: "Genes TSV", onClick: () => downloadGenes(visibleGenes, "tsv") },
    { label: "Genes JSON", onClick: () => downloadGenes(visibleGenes, "json") },
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Box ref={outerRef} sx={{ display: "flex", flex: 1, gap: 0, minHeight: 0 }}>
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
          <GeneAnnotationToolbar
            genes={genes}
            showTreeButton={isMobile || useDrawer}
            familyFilter={familyFilter}
            onOpenTree={() => setDrawerOpen(true)}
            searchText={searchText}
            onSearchChange={setSearchText}
            counterText={`${visibleGenes.length} of ${genes.length} genes`}
            onResetView={handleResetView}
            exportItems={exportItems}
          />
          <Divider />
          {error ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Failed to load genes.</Alert>
            </Box>
          ) : (
            <>
              <Box ref={tableScrollRef} sx={{ flex: 1, overflow: "auto" }}>
                {isLoading || !deferredReady ? (
                  <GeneTableSkeleton />
                ) : (
                  <MapViewportWidthContext.Provider value={scrollViewportWidth}>
                    <GeneTable
                      genes={paginatedGenes}
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      scrollToGeneId={selectedGeneId}
                      expandedGeneIds={expandedGeneIds}
                      onToggleExpanded={toggleExpanded}
                      onFamilyClick={setFamilyFilter}
                    />
                  </MapViewportWidthContext.Provider>
                )}
              </Box>
              <TablePagination
                component="div"
                count={visibleGenes.length}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value))
                  setPage(0)
                }}
                rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
                sx={{ borderTop: 1, borderColor: "divider", flexShrink: 0, mr: 0.5 }}
              />
            </>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
