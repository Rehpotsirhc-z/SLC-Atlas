// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, CircularProgress, Typography } from "@mui/material"
import { useUIStore } from "@/store/uiStore"
import DownloadButton from "./DownloadButton"
import FamilyTree from "./FamilyTree"
import GeneTable from "./GeneTable"
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

  if (isLoading) return <CircularProgress />
  if (error) return <Typography color="error">Failed to load genes.</Typography>

  return (
    <Box sx={{ display: "flex", height: "100%", gap: 2 }}>
      <FamilyTree genes={genes} familyFilter={familyFilter} onSelectFamily={setFamilyFilter} />
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SearchBar value={searchText} onChange={setSearchText} />
          <Typography variant="body2" color="text.secondary">
            {visibleGenes.length} of {genes.length} genes
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflow: "auto" }}>
          <GeneTable
            genes={visibleGenes}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={toggleSort}
            scrollToGeneId={selectedGeneId}
          />
        </Box>
        <DownloadButton genes={visibleGenes} />
      </Box>
    </Box>
  )
}
