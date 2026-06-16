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
  expandedGeneIds: Set<string>
  onToggleExpand: (geneId: string) => void
  scrollToGeneId: string | null
}

const SORTABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Ensembl ID" },
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "position", label: "Position" },
  { key: "length", label: "Length" },
  { key: "category", label: "Family / Category" },
]

export default function GeneTable({
  genes,
  sortKey,
  sortDirection,
  onSort,
  expandedGeneIds,
  onToggleExpand,
  scrollToGeneId,
}: GeneTableProps) {
  return (
    <TableContainer>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            {SORTABLE_COLUMNS.map(({ key, label }) => (
              <TableCell key={key} align={key === "length" ? "right" : undefined}>
                <TableSortLabel
                  active={sortKey === key}
                  direction={sortKey === key ? sortDirection : "asc"}
                  onClick={() => onSort(key)}
                >
                  {label}
                </TableSortLabel>
              </TableCell>
            ))}
            <TableCell>Alias</TableCell>
            <TableCell padding="checkbox" />
            <TableCell>Links</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {genes.map((gene) => (
            <GeneRow
              key={gene.id}
              gene={gene}
              expanded={expandedGeneIds.has(gene.id)}
              onToggleExpand={onToggleExpand}
              isSelected={gene.id === scrollToGeneId}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
