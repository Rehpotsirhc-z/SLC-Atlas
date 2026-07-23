// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, RefObject } from "react"
import { Box } from "@mui/material"

export interface BarListRow {
  key: string
  label: ReactNode
  bar: ReactNode
  value: ReactNode
}

interface Props {
  gridRef: RefObject<HTMLDivElement | null>
  rows: BarListRow[]
}

// Each row's three cells sit directly in the grid via display:contents, the layout
// usePopupAutoWidth measures by reading row.children as [label, bar, value]
export default function BarListGrid({ gridRef, rows }: Props) {
  return (
    <Box
      ref={gridRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: 1.5,
        display: "grid",
        gridTemplateColumns: "minmax(0, max-content) minmax(48px, 1fr) max-content",
        alignItems: "center",
        columnGap: 1,
        rowGap: 0.75,
        alignContent: "start",
      }}
    >
      {rows.map((r) => (
        <Box key={r.key} sx={{ display: "contents" }}>
          {r.label}
          {r.bar}
          {r.value}
        </Box>
      ))}
    </Box>
  )
}
