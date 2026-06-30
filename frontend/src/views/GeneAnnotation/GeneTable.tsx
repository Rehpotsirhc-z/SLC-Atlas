// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material"
import type { Gene } from "@/types/gene"
import GeneRow from "./GeneRow"
import type { SortDirection, SortKey } from "./useGeneAnnotationState"

interface GeneTableProps {
  genes: Gene[]
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
  scrollToGeneId: string | null
  autoExpandGeneId: string | null
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
  fontSize: "0.7rem",
  letterSpacing: 0.5,
  textTransform: "uppercase" as const,
  color: "text.secondary",
}

export default function GeneTable({
  genes,
  sortKey,
  sortDirection,
  onSort,
  scrollToGeneId,
  autoExpandGeneId,
  onFamilyClick,
}: GeneTableProps) {
  return (
    <TableContainer sx={{ overflowX: "visible" }}>
      <Table size="small" stickyHeader>
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
                  {label}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell sx={headerCellSx}>Alias</TableCell>
            <TableCell padding="checkbox" sx={headerCellSx} />
            <TableCell sx={headerCellSx}>Links</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {genes.map((gene) => (
            <GeneRow
              key={gene.id}
              gene={gene}
              isSelected={gene.id === scrollToGeneId}
              autoExpand={gene.id === autoExpandGeneId}
              onFamilyClick={onFamilyClick}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
