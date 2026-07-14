// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { SvgIcon, type SvgIconProps } from "@mui/material"

const BOX = "M20 12 V18 a2 2 0 0 1 -2 2 H6 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 H12"

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

export function PopOutIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d={BOX} {...strokeProps} />
      <path d="M13 11 L20 4 M15 4 H20 V9" {...strokeProps} />
    </SvgIcon>
  )
}

export function PopInIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d={BOX} {...strokeProps} />
      <path d="M20 4 L13 11 M13 6 V11 H18" {...strokeProps} />
    </SvgIcon>
  )
}
