// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef } from "react"
import { Box, Divider, Paper, Popper, Typography, useMediaQuery, useTheme } from "@mui/material"
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
import {
  EDGE_PAD,
  GENE_TRACK_MAX_SHARE,
  GENE_TRACK_MIN_H,
  GUTTER_W,
  GUTTER_W_SM,
  MAX_GENE_ROWS,
} from "./constants"
import { collapseToGenes, layoutGenes, layoutTranscripts } from "./geneLayout"
import type { LaneData } from "./useCoverageData"
import { useGenomeBrowserState } from "./useGenomeBrowserState"
import { usePanGestures } from "./usePanGestures"
import { useSpaceBelow } from "./useSpaceBelow"

// Leave half a gutter between the settings button and its panel
const SETTINGS_GAP = EDGE_PAD / 2

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
  const { palette, custom } = useTheme()
  const isSmall = useMediaQuery(useTheme().breakpoints.down("sm"))
  // Measure lane widths from the scroller and gestures from the full plot
  const [frameRef, { w: frameWidth }] = useElementSize<HTMLDivElement>()
  // Measure the shared plot area independently of its children
  const [plotAreaRef, { h: plotAreaHeight }] = useElementSize<HTMLDivElement>()
  const plotRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLButtonElement>(null)
  // Keep the settings panel within the browser card
  const cardRef = useRef<HTMLDivElement>(null)

  const gutter = isSmall ? GUTTER_W_SM : GUTTER_W
  const plotWidth = Math.max(0, frameWidth - gutter - EDGE_PAD)
  const geneTrackMax = Math.max(GENE_TRACK_MIN_H, plotAreaHeight * GENE_TRACK_MAX_SHARE)
  const state = useGenomeBrowserState(frameRef, plotWidth)

  const gestures = usePanGestures({
    view: state.view,
    plotRef,
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
        ? layoutTranscripts(state.models.transcripts, state.modelGap, MAX_GENE_ROWS)
        : null
    const genes =
      state.drawn === "genes"
        ? layoutGenes(collapseToGenes(state.models.transcripts), state.modelGap, MAX_GENE_ROWS)
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

  // Fit the settings panel into the space below its button
  const settingsRoom = useSpaceBelow(
    settingsRef,
    cardRef,
    EDGE_PAD + SETTINGS_GAP,
    state.settingsOpen,
  )
  const settingsSx = useMemo(
    () => ({ position: "static", mt: `${SETTINGS_GAP}px`, maxHeight: settingsRoom || undefined }),
    [settingsRoom],
  )

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
        ref={cardRef}
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
          onToggleSettings={state.toggleSettings}
          settingsRef={settingsRef}
          counterText=""
          onResetView={state.view.reset}
          exportItems={exportItems}
          hasRegion={state.region != null}
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
                ref={plotRef}
                tabIndex={0}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  outline: "none",
                  cursor: "grab",
                  // A pan is not a text selection, and on touch it is not the browser's to claim
                  userSelect: "none",
                  touchAction: "pan-y",
                  "&:active": { cursor: "grabbing" },
                }}
                {...gestures}
              >
                <Box sx={{ flexShrink: 0, bgcolor: "background.paper" }}>
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

                <Box
                  ref={plotAreaRef}
                  sx={{
                    position: "relative",
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    ref={frameRef}
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: "auto",
                      overflowX: "hidden",
                      // Reserve scrollbar space so lanes and gene rows stay aligned
                      scrollbarGutter: "stable",
                    }}
                  >
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
                  </Box>

                  <Box sx={{ flexShrink: 0, mt: 1, bgcolor: "background.paper" }}>
                    <GeneTrack
                      transcripts={state.models.transcripts}
                      mode={state.drawn}
                      gap={state.modelGap}
                      empty={state.models.empty}
                      width={plotWidth}
                      gutter={gutter}
                      maxHeight={geneTrackMax}
                      view={state.view.view}
                      subscribe={state.view.subscribe}
                      liveView={state.view.liveView}
                    />
                  </Box>

                  <Box
                    ref={selectionRef}
                    sx={{
                      display: "none",
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      bgcolor: "secondary.main",
                      opacity: 0.18,
                      pointerEvents: "none",
                      zIndex: 4,
                    }}
                  />
                </Box>
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
                  Search for a gene or a place written{" "}
                  <Box component="span" sx={{ fontFamily: custom.monoFontFamily }}>
                    chr:start-end
                  </Box>{" "}
                  to see its genomic neighborhood.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Drag to pan · ⌘/Ctrl + scroll to zoom · shift-drag to select a range
                </Typography>
              </Box>
            )}

            {state.settingsOpen && (
              <Popper
                open
                anchorEl={settingsRef.current}
                placement="bottom-start"
                modifiers={[
                  // Keep the panel below its button and shift it inside the card when space is tight
                  { name: "flip", enabled: false },
                  {
                    name: "preventOverflow",
                    options: { boundary: cardRef.current, padding: EDGE_PAD },
                  },
                ]}
                sx={{ zIndex: (theme) => theme.zIndex.modal }}
              >
                <BrowserSettings
                  prefs={state.prefs}
                  onChange={state.updatePrefs}
                  onClose={state.closeSettings}
                  anchorRef={settingsRef}
                  tracks={state.allTracks}
                  sx={settingsSx}
                />
              </Popper>
            )}
          </ViewStatus>
        </Box>
      </Paper>
    </Box>
  )
}
