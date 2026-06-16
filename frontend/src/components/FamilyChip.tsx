// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Chip, useTheme } from "@mui/material"
import { getFamilyColor } from "@/utils/familyColor"

interface FamilyChipProps {
  family: string
  label: string
}

export default function FamilyChip({ family, label }: FamilyChipProps) {
  const { palette } = useTheme()
  const color = getFamilyColor(family, palette.mode)

  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      sx={{ borderColor: color, color, fontWeight: 500 }}
    />
  )
}
