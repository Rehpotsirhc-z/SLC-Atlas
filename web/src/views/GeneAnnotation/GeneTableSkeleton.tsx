// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Skeleton, Table, TableBody, TableCell, TableRow } from "@mui/material"

const SKELETON_ROWS = 8

export default function GeneTableSkeleton() {
  return (
    <Table size="small">
      <TableBody>
        {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
          <TableRow key={row}>
            <TableCell padding="checkbox">
              <Skeleton variant="circular" width={18} height={18} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="80%" />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="55%" />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="90%" />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="70%" />
            </TableCell>
            <TableCell align="right">
              <Skeleton variant="text" width="50%" sx={{ ml: "auto" }} />
            </TableCell>
            <TableCell>
              <Skeleton variant="rounded" width={84} height={20} />
            </TableCell>
            <TableCell>
              <Skeleton variant="text" width="40%" />
            </TableCell>
            <TableCell padding="checkbox" />
            <TableCell>
              <Skeleton variant="text" width="50%" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
