// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { alpha, emphasize, type Theme } from "@mui/material/styles"

export const floatSurfaceBg = (theme: Theme) => alpha(theme.palette.background.paper, 0.9)

export const floatSurfaceBgHover = (theme: Theme) =>
  alpha(emphasize(theme.palette.background.paper, 0.06), 0.9)

// Bordered translucent skin shared by hover and family-label tooltips
export const tooltipSurfaceSx = {
  bgcolor: "background.default",
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  boxShadow: 3,
  pt: 0.5,
  pb: 0.375,
} as const
