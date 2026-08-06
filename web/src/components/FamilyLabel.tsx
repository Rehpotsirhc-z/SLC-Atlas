// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Tooltip } from "@mui/material"
import { capBoxSx, tooltipSurfaceSx } from "@/theme"

const CAP_HEIGHT_EM = "0.7em"

interface FamilyLabelProps {
  label: string
  color: string
  familyName?: string | null
  category?: string | null
}

export default function FamilyLabel({ label, color, familyName, category }: FamilyLabelProps) {
  return (
    <Tooltip
      placement="left"
      disableHoverListener={!category}
      slotProps={{
        tooltip: {
          sx: {
            ...tooltipSurfaceSx,
            color: "text.primary",
            px: 1.25,
            m: 0,
            maxWidth: 240,
            fontSize: "0.7rem",
            lineHeight: 1.45,
          },
        },
      }}
      title={
        category ? (
          <>
            {familyName && <Box sx={{ fontWeight: 600, display: "block" }}>{familyName}</Box>}
            <Box sx={{ color: "text.secondary", display: "block" }}>{category}</Box>
          </>
        ) : (
          ""
        )
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
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
  )
}
