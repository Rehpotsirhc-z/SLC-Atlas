// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// trim the line box to cap height / baseline so all-caps text centers against sibling icons
export const capBoxSx = {
  textBoxTrim: "trim-both",
  textBoxEdge: "cap alphabetic",
} as const

export const capButtonSx = {
  "&.MuiButton-sizeSmall": { minHeight: "calc(1.75em + 8px)" },
  "&.MuiButton-sizeMedium": { minHeight: "calc(1.75em + 12px)" },
} as const
