// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from "react"
import { Alert, Box, CircularProgress } from "@mui/material"

interface Props {
  error: unknown
  loading: boolean
  errorMessage: string
  children: ReactNode
}

export default function ViewStatus({ error, loading, errorMessage, children }: Props) {
  if (error)
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{errorMessage}</Alert>
      </Box>
    )
  if (loading)
    return (
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    )
  return <>{children}</>
}
