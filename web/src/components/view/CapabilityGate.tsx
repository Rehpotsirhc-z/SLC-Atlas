// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import { Box, Typography } from "@mui/material"
import { useCapabilities } from "@/api/hooks/useCapabilities"
import ViewHeader from "./ViewHeader"

export default function CapabilityGate({
  capability,
  label,
  children,
}: {
  capability?: string
  label: string
  children: ReactNode
}) {
  const { data } = useCapabilities()
  if (!capability) return <>{children}</>
  if (!data) return null
  if (data[capability]) return <>{children}</>
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <ViewHeader title={label} subtitle="Not available for this dataset" />
      <Typography variant="body2" color="text.secondary">
        This dataset was built without {label.toLowerCase()} data.
      </Typography>
    </Box>
  )
}
