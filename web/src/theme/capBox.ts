// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Trim the line box so all-caps text centers beside icons
export const capBoxSx = {
  textBoxTrim: "trim-both",
  textBoxEdge: "cap alphabetic",
} as const

// Give back the leading the trim took, so a label centers without shrinking its control
export const capLineSx = {
  ...capBoxSx,
  marginBlock: "calc((1lh - 1cap) / 2)",
} as const

export const capButtonSx = {
  "&.MuiButton-sizeSmall": { minHeight: "calc(1.75em + 8px)" },
  "&.MuiButton-sizeMedium": { minHeight: "calc(1.75em + 12px)" },
} as const
