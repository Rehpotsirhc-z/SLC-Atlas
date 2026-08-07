// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material"
import type { Theme } from "@mui/material/styles"
import { capBoxSx } from "@/theme"
import type { Gene } from "@/types/gene"
import GeneRow from "./GeneRow"
import type { SortDirection, SortKey } from "./useGeneAnnotationState"

interface GeneTableProps {
  genes: Gene[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
  scrollToGeneId: string | null
  expandedGeneIds: ReadonlySet<string>
  onToggleExpanded: (geneId: string) => void
  onFamilyClick?: (family: string) => void
}

const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Ensembl ID" },
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "position", label: "Position" },
  { key: "length", label: "Length" },
  { key: "family", label: "Family" },
]

const headerCellSx = {
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  color: "text.secondary",
}

const bodySx = (theme: Theme) => ({
  "& td.mono": {
    fontFamily: theme.custom.monoFontFamily,
    fontSize: theme.custom.monoFontSize,
  },
  "& td.gene-links": {
    whiteSpace: "nowrap",
  },
  "& .gene-external-link": {
    display: "inline-flex",
    alignItems: "center",
    verticalAlign: "middle",
    gap: "6px",
    padding: "4px 5px",
    borderRadius: 1,
    color: "primary.main",
    fontSize: "0.8125rem",
    fontWeight: 500,
    lineHeight: 1.75,
    textDecoration: "none",
    "&:hover": { bgcolor: "action.hover" },
    "& svg": { width: 18, height: 18, fill: "currentColor" },
  },
  "& .gene-external-link + .gene-external-link": { marginLeft: "2px" },
})

export default function GeneTable({
  genes,
  sortKey,
  sortDirection,
  onSort,
  scrollToGeneId,
  expandedGeneIds,
  onToggleExpanded,
  onFamilyClick,
}: GeneTableProps) {
  return (
    <TableContainer sx={{ overflowX: "visible" }}>
      <Table size="small" stickyHeader sx={bodySx}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={headerCellSx} />
            {SORTABLE_COLUMNS.map(({ key, label }) => (
              <TableCell key={key} align={key === "length" ? "right" : undefined} sx={headerCellSx}>
                <TableSortLabel
                  active={sortKey === key}
                  direction={sortKey === key ? sortDirection : "asc"}
                  onClick={() => onSort(key)}
                >
                  <Box component="span" sx={{ display: "inline-block", ...capBoxSx }}>
                    {label}
                  </Box>
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell sx={headerCellSx}>
              <Box component="span" sx={{ display: "inline-block", ...capBoxSx }}>
                Alias
              </Box>
            </TableCell>
            <TableCell padding="checkbox" sx={headerCellSx} />
            <TableCell sx={headerCellSx}>
              <Box component="span" sx={{ display: "inline-block", ...capBoxSx }}>
                Links
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {genes.map((gene) => (
            <GeneRow
              key={gene.id}
              gene={gene}
              isSelected={gene.id === scrollToGeneId}
              expanded={expandedGeneIds.has(gene.id)}
              onToggleExpanded={onToggleExpanded}
              onFamilyClick={onFamilyClick}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
