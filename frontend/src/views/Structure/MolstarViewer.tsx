// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from "react"
import { Box, CircularProgress, Typography, useTheme } from "@mui/material"
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context"
import { VIEWER_HEIGHT } from "./constants"
import { downloadModelPng } from "./molstar/export"
import { applyHighlight, clearFocus, focusSpans } from "./molstar/highlight"
import { loadModel } from "./molstar/load"
import { createViewer, disposeViewer } from "./molstar/plugin"
import { syncBackground } from "./molstar/theme"
import type { ModelExporter, ModelSource, ResidueSpan } from "./molstar/types"

interface Props {
  source: ModelSource
  background: string
  highlightSpans: ResidueSpan[]
  focusedSpans: ResidueSpan[] | null
  onExporterChange: (exporter: ModelExporter | null) => void
}

export default function MolstarViewer({
  source,
  background,
  highlightSpans,
  focusedSpans,
  onExporterChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const teardown = useRef<Promise<void>>(Promise.resolve())
  const [plugin, setPlugin] = useState<PluginUIContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { palette } = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    const ready = teardown.current.then(async () => {
      if (cancelled) return null
      const created = await createViewer(container)
      if (cancelled) {
        disposeViewer(created, container)
        return null
      }
      setPlugin(created)
      return created
    })

    return () => {
      cancelled = true
      setPlugin(null)
      teardown.current = ready.then((created) => {
        if (created) disposeViewer(created, container)
      })
    }
  }, [])

  useEffect(() => {
    if (!plugin) return
    let cancelled = false
    setError(null)
    loadModel(plugin, source).catch(() => {
      if (!cancelled) setError("Could not load these coordinates.")
    })
    return () => {
      cancelled = true
    }
  }, [plugin, source])

  useEffect(() => {
    if (plugin) syncBackground(plugin, background)
  }, [plugin, background])

  useEffect(() => {
    onExporterChange(plugin ? (filename) => downloadModelPng(plugin, filename) : null)
    return () => onExporterChange(null)
  }, [plugin, onExporterChange])

  useEffect(() => {
    if (!plugin || error) return
    applyHighlight(plugin, highlightSpans)
  }, [plugin, error, highlightSpans])

  useEffect(() => {
    if (!plugin || error) return
    if (focusedSpans) focusSpans(plugin, focusedSpans)
    else clearFocus(plugin)
  }, [plugin, error, focusedSpans])

  useEffect(() => {
    const container = containerRef.current
    if (!plugin || !container) return
    const observer = new ResizeObserver(() => plugin.handleResize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [plugin])

  return (
    <Box sx={{ position: "relative", height: VIEWER_HEIGHT, width: "100%" }}>
      <Box
        ref={containerRef}
        data-testid="molstar-canvas"
        className={palette.mode === "dark" ? "molstar-doom-one" : "molstar-doom-one-light"}
        sx={{ position: "absolute", inset: 0, "--atlas-viewer-height": `${VIEWER_HEIGHT}px` }}
      />
      {(!plugin || error) && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          {error ? (
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          ) : (
            <CircularProgress size={24} />
          )}
        </Box>
      )}
    </Box>
  )
}
