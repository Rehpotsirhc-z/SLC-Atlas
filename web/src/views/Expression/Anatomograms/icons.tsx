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

const ATTRIBUTION_GLYPH =
  "M37.443-3.5q13.483 0 22.742 9.257Q69.499 15.072 69.5 28.5q0 13.486-9.145 22.456Q50.641 60.5 37.443 60.5q-12.973 0-22.514-9.43Q5.501 41.642 5.5 28.5t9.429-22.742Q24.186-3.501 37.443-3.5m.114 5.772q-10.914 0-18.457 7.657-7.83 8.001-7.829 18.572 0 10.63 7.77 18.398 7.771 7.772 18.514 7.771 10.685.002 18.629-7.828 7.543-7.257 7.543-18.343 0-10.913-7.656-18.571-7.656-7.656-18.514-7.656m8.572 18.285v13.085h-3.656v15.542h-9.944V33.643h-3.656V20.557q0-.857.599-1.457.602-.6 1.457-.6h13.144q.8 0 1.428.6t.628 1.457m-13.087-8.228q0-4.513 4.458-4.514 4.458 0 4.457 4.514 0 4.457-4.457 4.457t-4.458-4.457"

export function AttributionIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="5.5 -3.5 64 64">
      <path d={ATTRIBUTION_GLYPH} fill="currentColor" />
    </SvgIcon>
  )
}
