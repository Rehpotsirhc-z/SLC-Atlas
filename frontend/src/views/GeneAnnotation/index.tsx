// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Alert, Box, Divider, Paper, TablePagination, Toolbar, Typography } from "@mui/material"
import { useUIStore } from "@/store/uiStore"
import DownloadButton from "./DownloadButton"
import FamilyTree from "./FamilyTree"
import GeneTable from "./GeneTable"
import GeneTableSkeleton from "./GeneTableSkeleton"
import SearchBar from "./SearchBar"
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
  } = useGeneAnnotationState()

  const paginatedGenes = visibleGenes.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={600} color="primary">
          Genes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          SLC superfamily gene and transcript annotation browser
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flex: 1, gap: 2, minHeight: 0 }}>
        <FamilyTree genes={genes} familyFilter={familyFilter} onSelectFamily={setFamilyFilter} />
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
          <Toolbar disableGutters sx={{ px: 2, gap: 2 }}>
            <SearchBar genes={genes} value={searchText} onChange={setSearchText} />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="success.main" sx={{ whiteSpace: "nowrap" }}>
              {visibleGenes.length} of {genes.length} genes
            </Typography>
            <Divider orientation="vertical" flexItem />
            <DownloadButton genes={visibleGenes} />
          </Toolbar>
          <Divider />
          {error ? (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">Failed to load genes.</Alert>
            </Box>
          ) : (
            <>
              <Box sx={{ flex: 1, overflow: "auto" }}>
                {isLoading ? (
                  <GeneTableSkeleton />
                ) : (
                  <GeneTable
                    genes={paginatedGenes}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={toggleSort}
                    scrollToGeneId={selectedGeneId}
                    autoExpandGeneId={visibleGenes.length <= 3 ? selectedGeneId : null}
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
