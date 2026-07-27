// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material"
import { pdbeUrl } from "@/utils/links"
import { EXPERIMENTAL_PAGE_SIZE, RESOLUTION_DECIMALS } from "./constants"
import type { ExperimentalStructure } from "@/types/structure"

interface Props {
  entries: ExperimentalStructure[]
}

export default function ExperimentalTable({ entries }: Props) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(EXPERIMENTAL_PAGE_SIZE)

  const visible = entries.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>PDB</TableCell>
              <TableCell>Method</TableCell>
              <TableCell align="right">Resolution</TableCell>
              <TableCell align="right">Coverage</TableCell>
              <TableCell>Residues</TableCell>
              <TableCell>Ligands</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((entry) => (
              <TableRow key={entry.pdb_id} hover>
                <TableCell>
                  <Link href={pdbeUrl(entry.pdb_id)} target="_blank" rel="noopener">
                    {entry.pdb_id.toUpperCase()}
                  </Link>
                </TableCell>
                <TableCell sx={{ textTransform: "lowercase" }}>{entry.method ?? "-"}</TableCell>
                <TableCell align="right">
                  {entry.resolution != null
                    ? `${entry.resolution.toFixed(RESOLUTION_DECIMALS)} Å`
                    : "-"}
                </TableCell>
                <TableCell align="right">
                  {entry.coverage != null ? `${(entry.coverage * 100).toFixed(0)}%` : "-"}
                </TableCell>
                <TableCell>
                  {entry.uniprot_start != null && entry.uniprot_end != null
                    ? `${entry.uniprot_start}-${entry.uniprot_end}`
                    : "-"}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                    {entry.ligand_ccd ?? "-"}
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
