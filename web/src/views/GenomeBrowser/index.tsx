// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef } from "react"
import { Box, Divider, Paper, Typography, useMediaQuery, useTheme } from "@mui/material"
import { EMPTY_COVERAGE } from "@/api/bbi"
import { useCapability } from "@/api/hooks/useCapabilities"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { biotypeColor } from "@/utils/biotypeColor"
import { downloadName } from "@/utils/download"
import { figureExportHandlers } from "@/utils/exportFigure"
import { useElementSize } from "@/utils/useElementSize"
import BrowserSettings from "./BrowserSettings"
import BrowserToolbar from "./BrowserToolbar"
import GeneTrack from "./GeneTrack"
import GwasLane from "./GwasLane"
import LocusHeading, { locusText } from "./LocusHeading"
import Ruler from "./Ruler"
import TrackLane from "./TrackLane"
import { buildBrowserFigureSvg, type FigureLane } from "./browserFigureSvg"
import { EDGE_PAD, GUTTER_W, GUTTER_W_SM, MAX_GENE_ROWS, RULER_H } from "./constants"
import { collapseToGenes, layoutGenes, layoutTranscripts } from "./geneLayout"
import type { LaneData } from "./useCoverageData"
import { useGenomeBrowserState } from "./useGenomeBrowserState"
import { usePanGestures } from "./usePanGestures"

const SETTINGS_SX = { top: 8, right: 8, zIndex: 6 } as const

// Keep the loading placeholder stable across renders
const UNREAD: LaneData = {
  plus: EMPTY_COVERAGE,
  minus: null,
  loading: true,
  failed: false,
  absent: false,
}

export default function GenomeBrowser() {
  const available = useCapability("browser")
  const { palette } = useTheme()
  const isSmall = useMediaQuery(useTheme().breakpoints.down("sm"))
  const [frameRef, { w: frameWidth }] = useElementSize<HTMLDivElement>()
  const selectionRef = useRef<HTMLDivElement>(null)

  const gutter = isSmall ? GUTTER_W_SM : GUTTER_W
  const plotWidth = Math.max(0, frameWidth - gutter - EDGE_PAD)
  const state = useGenomeBrowserState(frameRef, plotWidth)

  const gestures = usePanGestures({
    view: state.view,
    plotRef: frameRef,
    selectionRef,
    width: plotWidth,
    gutter,
    enabled: state.region != null && plotWidth > 0,
  })

  const buildFigure = useCallback(() => {
    const region = state.region
    if (!region) return null
    const lanes: FigureLane[] = state.tracks.map((track) => {
      const lane = state.coverage.get(track.track_id)
      return {
        track,
        color: state.colors.get(track.label) ?? palette.primary.main,
        plus: lane?.plus ?? EMPTY_COVERAGE,
        minus: lane?.minus ?? null,
      }
    })
    const transcripts =
      state.drawn === "transcripts"
        ? layoutTranscripts(state.models.transcripts, state.models.gap, MAX_GENE_ROWS)
        : null
    const genes =
      state.drawn === "genes"
        ? layoutGenes(collapseToGenes(state.models.transcripts), state.models.gap, MAX_GENE_ROWS)
        : null
    return buildBrowserFigureSvg({
      view: state.view.view,
      chrom: region.chrom,
      title: `${region.symbol ?? region.gene_id} · ${locusText(region.chrom, state.view.view)}`,
      lanes,
      laneHeight: state.prefs.laneHeight,
      yMax: state.yMaxFor(),
      study: state.prefs.showGwas ? (state.study ?? null) : null,
      gwasPoints: state.gwasPoints,
      showGwas: state.prefs.showGwas,
      showSignificance: state.prefs.showSignificance,
      transcripts,
      genes,
      colorOf: (biotype) => biotypeColor(biotype, palette.mode),
      ink: {
        text: palette.text.primary,
        muted: palette.text.secondary,
        axis: palette.divider,
        background: palette.background.paper,
        raised: palette.error.main,
        lowered: palette.primary.main,
        significance: palette.warning.main,
        highlight: palette.secondary.main,
      },
    })
  }, [state, palette])

  const { exportSvg, exportPng } = useMemo(() => figureExportHandlers(buildFigure), [buildFigure])

  const exportItems = useMemo(
    () => [
      { label: "Genome browser SVG", onClick: () => exportSvg(downloadName("genome_browser.svg")) },
      { label: "Genome browser PNG", onClick: () => exportPng(downloadName("genome_browser.png")) },
    ],
    [exportSvg, exportPng],
  )

  if (!available) {
    return (
      <Box>
        <ViewHeader title="Genome Browser" subtitle="Not available for this dataset" />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          This dataset was built without genome browser data.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 2 }}>
      <ViewHeader
        title="Genome Browser"
        subtitle="Coverage tracks, trait associations, and gene models on one genomic axis"
      />
      <Paper
        variant="outlined"
        sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
      >
        <BrowserToolbar
          genes={state.genes}
          mode={state.mode}
          onModeChange={state.setMode}
          onSelectGene={state.setSelectedGeneId}
          onGoToLocus={state.goToLocus}
          onZoom={(factor) => state.view.zoomBy(factor)}
          settingsOpen={state.settingsOpen}
          onToggleSettings={() => state.setSettingsOpen(!state.settingsOpen)}
          counterText=""
          onResetView={state.view.reset}
          exportItems={exportItems}
          disabled={!state.region}
        />
        <Divider />
        <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
          <ViewStatus
            error={state.error}
            loading={state.loading}
            errorMessage="Failed to load genome browser data"
          >
            {state.region ? (
              <Box
                ref={frameRef}
                tabIndex={0}
                sx={{
                  height: "100%",
                  overflowY: "auto",
                  overflowX: "hidden",
                  position: "relative",
                  outline: "none",
                  cursor: "grab",
                  // A pan is not a text selection, and on touch it is not the browser's to claim
                  userSelect: "none",
                  touchAction: "pan-y",
                  "&:active": { cursor: "grabbing" },
                }}
                {...gestures}
              >
                <Box
                  sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 3,
                    bgcolor: "background.paper",
                  }}
                >
                  <LocusHeading
                    chrom={state.region.chrom}
                    symbol={state.region.symbol}
                    subscribe={state.view.subscribe}
                  />
                  <Ruler
                    width={plotWidth}
                    gutter={gutter}
                    subscribe={state.view.subscribe}
                    liveView={state.view.liveView}
                  />
                </Box>

                {state.groups.map((group) => (
                  <Box key={group.name} sx={{ mt: 1 }}>
                    <Typography
                      sx={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: 0.7,
                        color: "primary.main",
                        pl: `${EDGE_PAD}px`,
                        pb: 0.5,
                      }}
                    >
                      {group.name}
                    </Typography>
                    {group.members.map((track) => (
                      <TrackLane
                        key={track.track_id}
                        track={track}
                        data={state.coverage.get(track.track_id) ?? UNREAD}
                        color={state.colors.get(track.label) ?? palette.primary.main}
                        height={state.prefs.laneHeight}
                        width={plotWidth}
                        gutter={gutter}
                        grid={state.prefs.showGrid}
                        yMax={state.yMaxFor()}
                        subscribe={state.view.subscribe}
                        liveView={state.view.liveView}
                        moving={state.view.moving}
                        watch={state.watchLane}
                      />
                    ))}
                  </Box>
                ))}

                {state.prefs.showGwas && state.study && (
                  <Box sx={{ mt: 1 }}>
                    <Typography
                      sx={{
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: 0.7,
                        color: "primary.main",
                        pl: `${EDGE_PAD}px`,
                        pb: 0.5,
                      }}
                    >
                      GWAS
                    </Typography>
                    <GwasLane
                      study={state.study}
                      points={state.gwasPoints}
                      covered={state.studyCovers}
                      thinned={state.gwasThinned}
                      loading={state.gwasLoading}
                      width={plotWidth}
                      gutter={gutter}
                      grid={state.prefs.showGrid}
                      showSignificance={state.prefs.showSignificance}
                      subscribe={state.view.subscribe}
                      liveView={state.view.liveView}
                      moving={state.view.moving}
                      watch={state.watchLane}
                    />
                  </Box>
                )}

                <Box
                  sx={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 3,
                    bgcolor: "background.paper",
                    mt: 1,
                  }}
                >
                  <GeneTrack
                    transcripts={state.models.transcripts}
                    mode={state.drawn}
                    gap={state.models.gap}
                    empty={state.models.empty}
                    width={plotWidth}
                    gutter={gutter}
                    subscribe={state.view.subscribe}
                    liveView={state.view.liveView}
                  />
                </Box>

                <Box
                  ref={selectionRef}
                  sx={{
                    display: "none",
                    position: "absolute",
                    top: RULER_H,
                    bottom: 0,
                    bgcolor: "secondary.main",
                    opacity: 0.18,
                    pointerEvents: "none",
                    zIndex: 4,
                  }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  px: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Search for a gene to see its genomic neighbourhood.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Drag to pan · ⌘/Ctrl + scroll to zoom · shift-drag to select a range
                </Typography>
              </Box>
            )}

            {state.settingsOpen && (
              <BrowserSettings
                prefs={state.prefs}
                onChange={state.updatePrefs}
                tracks={state.allTracks}
                sx={SETTINGS_SX}
              />
            )}
          </ViewStatus>
        </Box>
      </Paper>
    </Box>
  )
}
