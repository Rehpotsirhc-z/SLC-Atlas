// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ComponentType } from "react"
import { Box, ButtonBase, Typography, type SvgIconProps } from "@mui/material"
import { alpha } from "@mui/material/styles"

interface Props {
  label: string
  description: string
  accent: string
  Icon: ComponentType<SvgIconProps>
  onClick: () => void
}

export default function ViewTile({ label, description, accent, Icon, onClick }: Props) {
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 1.5,
        p: 2,
        height: "100%",
        textAlign: "left",
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        "&:hover": { borderColor: accent, boxShadow: 3, transform: "translateY(-2px)" },
        "&:focus-visible": { borderColor: accent },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          color: accent,
          bgcolor: alpha(accent, 0.14),
        }}
      >
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{label}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.35 }}>
          {description}
        </Typography>
      </Box>
    </ButtonBase>
  )
}
