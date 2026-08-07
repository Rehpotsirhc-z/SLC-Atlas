// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Alert, Box, Divider, Paper, TablePagination, useMediaQuery, useTheme } from "@mui/material"
import FamilyRail from "@/components/view/FamilyRail"
import { useFamilyRail } from "@/components/view/useFamilyRail"
import ViewHeader from "@/components/view/ViewHeader"
import { atlas } from "@/config/atlas"
import { useUIStore } from "@/store/uiStore"
import { MIN_CONTENT_WIDTH } from "./constants"
import GeneAnnotationToolbar from "./GeneAnnotationToolbar"
import { downloadGenes } from "./geneDownloads"
import GeneTable from "./GeneTable"
import GeneTableSkeleton from "./GeneTableSkeleton"
import { useGeneAnnotationState } from "./useGeneAnnotationState"

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
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const handledGeneIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedGeneId || handledGeneIdRef.current === selectedGeneId) return
    const idx = visibleGenes.findIndex((g) => g.id === selectedGeneId)
    if (idx === -1) return
    const targetPage = Math.floor(idx / rowsPerPage)
    if (page !== targetPage) {
      setPage(targetPage)
      return
    }
    const row = tableScrollRef.current?.querySelector<HTMLElement>(
      `[data-gene-id="${CSS.escape(selectedGeneId)}"]`,
    )
    if (!row) return
    handledGeneIdRef.current = selectedGeneId
    // Wait for the Collapse animation to finish before centering so that it
    // doesn't get pushed down by the expanded content
    const t = setTimeout(() => {
      row.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 300)
    return () => clearTimeout(t)
  }, [selectedGeneId, visibleGenes, rowsPerPage, page])

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
    if (isLoading) return
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
  }, [isLoading, expandRail])

  const exportItems = [
    { label: "Genes TSV", onClick: () => downloadGenes(visibleGenes, "tsv") },
    { label: "Genes JSON", onClick: () => downloadGenes(visibleGenes, "json") },
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <ViewHeader title="Genes" subtitle={atlas.description} />
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
                {isLoading ? (
                  <GeneTableSkeleton />
                ) : (
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
                rowsPerPageOptions={[25, 50, 100]}
                sx={{ borderTop: 1, borderColor: "divider", flexShrink: 0, mr: 0.5 }}
              />
            </>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
