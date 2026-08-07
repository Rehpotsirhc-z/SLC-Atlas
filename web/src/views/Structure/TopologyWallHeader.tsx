// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from "@mui/material"
import { atlas } from "@/config/atlas"
import { capBoxSx } from "@/theme"

interface Props {
  family: string | null
  category: string | null
  count: number
}

export default function TopologyWallHeader({ family, category, count }: Props) {
  const title = family
    ? `${family}${category ? ` · ${category}` : ""}`
    : `All ${atlas.familyLabel} families`

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        columnGap: 2,
        mb: 1.5,
      }}
    >
      <Typography variant="h6" color="primary" sx={{ ...capBoxSx, lineHeight: 1.4 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ ...capBoxSx, flexShrink: 0 }}>
        {count === 1 ? "1 gene" : `${count} genes`}
      </Typography>
    </Box>
  )
}
