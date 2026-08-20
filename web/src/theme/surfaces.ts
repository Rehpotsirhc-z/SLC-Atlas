// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { keyframes } from "@mui/system"

export const glowFlash = keyframes`
  0%   { outline: 2px solid rgba(144, 202, 249, 0.9); }
  100% { outline: 2px solid rgba(144, 202, 249, 0); }
`

export const glowFlashSx = { animation: `${glowFlash} 0.8s ease-out` } as const

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
