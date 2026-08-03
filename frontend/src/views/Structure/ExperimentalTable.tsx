// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material"
import { pdbeUrl } from "@/utils/links"
import { EXPERIMENTAL_PAGE_SIZE } from "./constants"
import { ligandLabel, methodLabel, resolutionLabel } from "./experimentalEntry"
import { sortExperimental, type ExperimentalSortKey } from "./experimentalSort"
import type { ExperimentalStructure } from "@/types/structure"
import type { SortDir } from "@/types/table"

const COLUMNS: {
  key: ExperimentalSortKey
  label: string
  align: "left" | "right"
}[] = [
  { key: "pdb_id", label: "PDB", align: "left" },
  { key: "method", label: "Method", align: "left" },
  { key: "resolution", label: "Resolution", align: "right" },
  { key: "coverage", label: "Coverage", align: "right" },
  { key: "residues", label: "Residues", align: "left" },
  { key: "ligands", label: "Ligands", align: "left" },
]

interface Props {
  entries: ExperimentalStructure[]
  selectedPdbId: string | null
  onSelect: (pdbId: string) => void
}

export default function ExperimentalTable({ entries, selectedPdbId, onSelect }: Props) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(EXPERIMENTAL_PAGE_SIZE)
  const [sortKey, setSortKey] = useState<ExperimentalSortKey>("pdb_id")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  function handleSort(key: ExperimentalSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(0)
  }

  const sorted = useMemo(
    () => sortExperimental(entries, sortKey, sortDir),
    [entries, sortKey, sortDir],
  )

  const visible = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map(({ key, label, align }) => (
                <TableCell
                  key={key}
                  align={align}
                  sortDirection={sortKey === key ? sortDir : false}
                >
                  <TableSortLabel
                    active={sortKey === key}
                    direction={sortKey === key ? sortDir : "asc"}
                    onClick={() => handleSort(key)}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((entry) => (
              <TableRow
                key={entry.pdb_id}
                hover
                selected={entry.pdb_id === selectedPdbId}
                onClick={() => onSelect(entry.pdb_id)}
                sx={{ cursor: "pointer" }}
                data-testid={`experimental-row-${entry.pdb_id}`}
              >
                <TableCell>
                  {/* Stops the row's load-in-the-viewer click when the intent was PDBe */}
                  <Link
                    href={pdbeUrl(entry.pdb_id)}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.pdb_id.toUpperCase()}
                  </Link>
                </TableCell>
                <TableCell>{methodLabel(entry.method) ?? "—"}</TableCell>
                <TableCell align="right">{resolutionLabel(entry.resolution) ?? "—"}</TableCell>
                <TableCell align="right">
                  {entry.coverage != null ? `${(entry.coverage * 100).toFixed(0)}%` : "—"}
                </TableCell>
                <TableCell>
                  {entry.uniprot_start != null && entry.uniprot_end != null
                    ? `${entry.uniprot_start}-${entry.uniprot_end}`
                    : "—"}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                    {ligandLabel(entry.ligand_ccd) ?? "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {entries.length > EXPERIMENTAL_PAGE_SIZE && (
        <TablePagination
          component="div"
          count={entries.length}
          page={page}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10))
            setPage(0)
          }}
        />
      )}
    </>
  )
}
