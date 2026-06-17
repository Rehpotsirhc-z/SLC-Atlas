// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Chip, Tooltip, useTheme } from "@mui/material"
import { getFamilyColor } from "@/utils/familyColor"

interface FamilyChipProps {
  family: string
  label: string
}

export default function FamilyChip({ family, label }: FamilyChipProps) {
  const { palette } = useTheme()
  const color = getFamilyColor(family, palette.mode)

  return (
    <Tooltip title={label} placement="top">
      <Chip
        size="small"
        variant="outlined"
        label={label}
        sx={{
          borderColor: color,
          color,
          fontWeight: 500,
          maxWidth: 220,
          "& .MuiChip-label": {
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
        }}
      />
    </Tooltip>
  )
}
