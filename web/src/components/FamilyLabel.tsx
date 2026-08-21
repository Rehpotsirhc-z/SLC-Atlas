// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Tooltip } from "@mui/material"
import { capBoxSx } from "@/theme"

const CAP_HEIGHT_EM = "0.7em"

interface FamilyLabelProps {
  label: string
  color: string
  category?: string | null
}

export default function FamilyLabel({ label, color, category }: FamilyLabelProps) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Tooltip
        placement="left"
        disableHoverListener={!category}
        title={category ? <Box sx={{ fontWeight: 600, display: "block" }}>{category}</Box> : ""}
      >
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "flex-end",
            gap: 0.75,
            cursor: category ? "help" : "default",
          }}
        >
          <Box
            sx={{
              width: CAP_HEIGHT_EM,
              height: CAP_HEIGHT_EM,
              flexShrink: 0,
              transform: "translateY(0.5px)",
              borderRadius: "2px",
              bgcolor: color,
            }}
          />
          <Box component="span" sx={capBoxSx}>
            {label}
          </Box>
        </Box>
      </Tooltip>
    </Box>
  )
}
