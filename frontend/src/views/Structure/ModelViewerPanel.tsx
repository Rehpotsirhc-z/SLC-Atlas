// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { lazy, Suspense, useState } from "react"
import ViewInArIcon from "@mui/icons-material/ViewInAr"
import { Box, Button, CircularProgress, Stack, Typography, useTheme } from "@mui/material"
import { VIEWER_HEIGHT } from "./constants"
import type { ModelExporter, ModelSource, ResidueSpan } from "./molstar/types"

const MolstarViewer = lazy(() => import("./MolstarViewer"))

interface Props {
  source: ModelSource | null
  deferLoad: boolean
  highlightSpans: ResidueSpan[]
  focusedSpans: ResidueSpan[] | null
  onExporterChange: (exporter: ModelExporter | null) => void
}

const NO_SPANS: ResidueSpan[] = []

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ height: VIEWER_HEIGHT, width: "100%" }}
    >
      {children}
    </Stack>
  )
}

export default function ModelViewerPanel({
  source,
  deferLoad,
  highlightSpans,
  focusedSpans,
  onExporterChange,
}: Props) {
  // Mol* is about a megabyte gzipped, so on a phone it waits to be asked for
  const [activated, setActivated] = useState(!deferLoad)
  const { palette } = useTheme()

  if (!source) {
    return (
      <Placeholder>
        <Typography variant="body2" color="text.secondary">
          No coordinates available for this protein.
        </Typography>
      </Placeholder>
    )
  }

  if (!activated) {
    return (
      <Placeholder>
        <Button
          variant="outlined"
          startIcon={<ViewInArIcon />}
          onClick={() => setActivated(true)}
          data-testid="load-3d"
        >
          Load 3D structure
        </Button>
        <Typography variant="caption" color="text.secondary">
          About 1 MB over the network
        </Typography>
      </Placeholder>
    )
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Suspense
        fallback={
          <Placeholder>
            <CircularProgress size={24} />
          </Placeholder>
        }
      >
        <MolstarViewer
          source={source}
          background={palette.background.default}
          highlightSpans={source.kind === "afdb" ? highlightSpans : NO_SPANS}
          focusedSpans={source.kind === "afdb" ? focusedSpans : null}
          onExporterChange={onExporterChange}
        />
      </Suspense>
    </Box>
  )
}
