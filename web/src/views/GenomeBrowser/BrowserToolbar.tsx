// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { RefObject } from "react"
import SettingsIcon from "@mui/icons-material/Tune"
import ZoomInIcon from "@mui/icons-material/ZoomIn"
import ZoomOutIcon from "@mui/icons-material/ZoomOut"
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material"
import ToolbarMeasureProbe from "@/components/view/ToolbarMeasureProbe"
import ViewToolbar from "@/components/view/ViewToolbar"
import ViewToolbarActions, { type ExportItem } from "@/components/view/ViewToolbarActions"
import { useToolbarFit } from "@/components/view/useToolbarFit"
import { capLineSx } from "@/theme"
import type { Gene } from "@/types/gene"
import LocusSearch, { type Locus } from "./LocusSearch"
import type { GeneTrackMode } from "./GeneTrack"

interface Props {
  genes: Gene[]
  mode: GeneTrackMode
  onModeChange: (mode: GeneTrackMode) => void
  onSelectGene: (geneId: string) => void
  onGoToLocus: (locus: Locus) => void
  onZoom: (factor: number) => void
  settingsOpen: boolean
  onToggleSettings: () => void
  settingsRef: RefObject<HTMLButtonElement | null>
  counterText: string
  onResetView: () => void
  exportItems: ExportItem[]
  hasRegion: boolean
}

const MODES: { value: GeneTrackMode; label: string }[] = [
  { value: "transcripts", label: "Transcripts" },
  { value: "genes", label: "Genes" },
]

export default function BrowserToolbar({
  genes,
  mode,
  onModeChange,
  onSelectGene,
  onGoToLocus,
  onZoom,
  settingsOpen,
  onToggleSettings,
  settingsRef,
  counterText,
  onResetView,
  exportItems,
  hasRegion,
}: Props) {
  const { tbState, toolbarRef, probeRefs } = useToolbarFit({ counterText, toggleCount: 2 })
  const wrapped = tbState === "wrapped"

  const modeToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={mode}
      onChange={(_event, next) => next && onModeChange(next)}
    >
      {MODES.map((option) => (
        <ToggleButton key={option.value} value={option.value} sx={{ minWidth: wrapped ? 0 : 96 }}>
          <Box component="span" sx={capLineSx}>
            {option.label}
          </Box>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )

  return (
    <>
      <ViewToolbar
        toolbarRef={toolbarRef}
        tbState={tbState}
        toggles={
          <>
            <LocusSearch
              genes={genes}
              onSelectGene={onSelectGene}
              onGoToLocus={onGoToLocus}
              width={wrapped ? "100%" : 300}
            />
            {modeToggle}
            <Box sx={{ display: "flex" }}>
              <Tooltip title="Zoom out">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Zoom out"
                    onClick={() => onZoom(0.5)}
                    disabled={!hasRegion}
                  >
                    <ZoomOutIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Zoom in">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Zoom in"
                    onClick={() => onZoom(2)}
                    disabled={!hasRegion}
                  >
                    <ZoomInIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={settingsOpen ? "" : "Display settings"}>
                <span>
                  <IconButton
                    ref={settingsRef}
                    size="small"
                    aria-label="Display settings"
                    onClick={onToggleSettings}
                    color={settingsOpen ? "secondary" : "default"}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </>
        }
        actions={
          <ViewToolbarActions
            tbState={tbState}
            counterText={counterText}
            onResetView={onResetView}
            exportItems={exportItems}
          />
        }
      />
      <ToolbarMeasureProbe refs={probeRefs} counterText={counterText}>
        <Box ref={probeRefs.registerToggle(0)} sx={{ width: 300 }} />
        <ToggleButtonGroup ref={probeRefs.registerToggle(1)} size="small" exclusive value={mode}>
          {MODES.map((option) => (
            <ToggleButton key={option.value} value={option.value} sx={{ minWidth: 96 }}>
              <Box component="span" sx={capLineSx}>
                {option.label}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </ToolbarMeasureProbe>
    </>
  )
}
