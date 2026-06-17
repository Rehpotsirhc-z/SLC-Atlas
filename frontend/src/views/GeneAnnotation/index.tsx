// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Alert, Box, Divider, Paper, Toolbar, Typography } from "@mui/material"
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
  } = useGeneAnnotationState()
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={600}>
          Genes
        </Typography>
        <Typography variant="body2" color="text.secondary">
          SLC superfamily gene and transcript annotation browser
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flex: 1, gap: 2, minHeight: 0 }}>
        <FamilyTree genes={genes} familyFilter={familyFilter} onSelectFamily={setFamilyFilter} />
        <Paper
          elevation={1}
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
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
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
            <Box sx={{ flex: 1, overflow: "auto" }}>
              {isLoading ? (
                <GeneTableSkeleton />
              ) : (
                <GeneTable
                  genes={visibleGenes}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                  scrollToGeneId={selectedGeneId}
                />
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
