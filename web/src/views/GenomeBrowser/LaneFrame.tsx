// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"

interface Props {
  flush?: boolean
}

export default function LaneFrame({ flush }: Props) {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        borderTop: flush ? 0 : 1,
        borderRight: 1,
        borderBottom: 1,
        borderColor: "text.disabled",
        pointerEvents: "none",
      }}
    />
  )
}
