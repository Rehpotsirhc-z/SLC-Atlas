// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import { RAIL_SPLITTER_WIDTH } from "./useFamilyRail"

interface Props {
  onDragStart: (e: React.MouseEvent) => void
}

export default function FamilyRailSplitter({ onDragStart }: Props) {
  return (
    <Box
      onMouseDown={onDragStart}
      sx={{
        width: RAIL_SPLITTER_WIDTH,
        flexShrink: 0,
        cursor: "col-resize",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&::after": {
          content: '""',
          display: "block",
          width: 2,
          height: "40%",
          borderRadius: 1,
          bgcolor: "divider",
          transition: "background-color 0.15s",
        },
        "&:hover::after": { bgcolor: "text.disabled" },
        userSelect: "none",
      }}
    />
  )
}
