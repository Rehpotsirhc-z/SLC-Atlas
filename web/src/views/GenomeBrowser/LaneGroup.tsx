// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import { Box } from "@mui/material"
import { GROUP_GAP } from "./constants"

export default function LaneGroup({ children }: { children: ReactNode }) {
  return <Box sx={{ mt: `${GROUP_GAP}px` }}>{children}</Box>
}
