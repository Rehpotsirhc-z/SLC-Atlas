// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef } from "react"
import { Box, Divider, Paper, Popper, Typography, useMediaQuery, useTheme } from "@mui/material"
import { EMPTY_COVERAGE, EMPTY_VARIANTS, type VariantBlock } from "@/api/bbi"
import ViewHeader from "@/components/view/ViewHeader"
import ViewStatus from "@/components/view/ViewStatus"
import { biotypeColor } from "@/utils/biotypeColor"
import { downloadName } from "@/utils/download"
import { downloadPng, downloadSvg } from "@/utils/exportFigure"
import { useElementSize } from "@/utils/useElementSize"
import BinCoveragePanel from "./BinCoveragePanel"
import BrowserGenePopup from "./BrowserGenePopup"
import BrowserSettings from "./BrowserSettings"
import BrowserToolbar from "./BrowserToolbar"
import GeneTrack, { type GeneTrackHandle } from "./GeneTrack"
import GwasTrack from "./GwasTrack"
import LaneGroup from "./LaneGroup"
import LocusHeading, { locusText } from "./LocusHeading"
import Ruler from "./Ruler"
import TrackLane from "./TrackLane"
import { buildBrowserFigureSvg, FIGURE_FIXED_W, type FigureLane } from "./browserFigureSvg"
import {
  AXIS_W,
  EDGE_PAD,
  GENE_TRACK_MAX_SHARE,
  GENE_TRACK_MIN_H,
  GUTTER_W,
  GUTTER_W_SM,
  MAX_GENE_ROWS,
} from "./constants"
import { collapseToGenes, layoutGenes, layoutTranscripts } from "./geneLayout"
import { useBrowserPick } from "./useBrowserPick"
import type { LaneData } from "./useCoverageData"
import { useGenomeBrowserState } from "./useGenomeBrowserState"
import { usePanGestures } from "./usePanGestures"
import { useSpaceBelow } from "./useSpaceBelow"

const SETTINGS_GAP = EDGE_PAD / 2

const UNREAD: LaneData = {
  plus: EMPTY_COVERAGE,
  minus: null,
  loading: true,
  failed: false,
  absent: false,
}

export default function GenomeBrowser() {
  const { palette, custom } = useTheme()
  const isSmall = useMediaQuery(useTheme().breakpoints.down("sm"))
  const [frameRef, { w: frameWidth }] = useElementSize<HTMLDivElement>()
  const [plotAreaRef, { h: plotAreaHeight }] = useElementSize<HTMLDivElement>()
  const plotRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const gwasBlockRef = useRef<VariantBlock | null>(null)
  const geneTrackRef = useRef<GeneTrackHandle | null>(null)

  const gutter = (isSmall ? GUTTER_W_SM : GUTTER_W) + AXIS_W
  const plotWidth = Math.max(0, frameWidth - gutter - EDGE_PAD)
  const geneTrackMax = Math.max(GENE_TRACK_MIN_H, plotAreaHeight * GENE_TRACK_MAX_SHARE)
  const state = useGenomeBrowserState(frameRef, plotWidth)

  const pick = useBrowserPick({
    geneTrackRef,
    groups: state.groups,
    coverage: state.coverage,
    colors: state.colors,
    fallbackColor: palette.primary.main,
    committedView: state.view.view,
  })

  const gestures = usePanGestures({
    view: state.view,
    plotRef,
    selectionRef,
    width: plotWidth,
    gutter,
    enabled: state.region != null && plotWidth > 0,
    onReset: state.resetView,
    onPick: pick.onPick,
  })

  const buildFigure = useCallback(
    (figureWidth: number) => {
      const region = state.region
      if (!region) return null
      const lanes: FigureLane[] = state.tracks.map((track) => {
        const lane = state.coverage.get(track.track_id)
        return {
          track,
          color: state.colors.get(track.label) ?? palette.primary.main,
          plus: lane?.plus ?? EMPTY_COVERAGE,
          minus: lane?.minus ?? null,
          absent: lane?.absent ?? UNREAD.absent,
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
        gwasBlock: gwasBlockRef.current ?? EMPTY_VARIANTS,
        showGwas: state.prefs.showGwas,
        showGrid: state.prefs.showGrid,
        showSignificance: state.prefs.showSignificance,
        plotWidth: figureWidth,
        transcripts,
        genes,
        colorOf: (biotype) => biotypeColor(biotype, palette.mode),
        ink: {
          text: palette.text.primary,
          muted: palette.text.secondary,
          primary: palette.primary.main,
          axis: palette.text.disabled,
          zero: palette.divider,
          plot: custom.plotSurface,
          background: palette.background.paper,
          raised: palette.error.main,
          lowered: palette.primary.main,
          significance: palette.warning.main,
        },
      })
    },
    [state, palette, custom],
  )

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

  const exportItems = useMemo(() => {
    const saveSvg = (width: number) => {
      const svg = buildFigure(width)
      if (svg) void downloadSvg(svg, downloadName("genome_browser.svg"))
    }
    const savePng = (width: number) => {
      const svg = buildFigure(width)
      if (svg) void downloadPng(svg, downloadName("genome_browser.png"))
    }
    const width = plotWidth || FIGURE_FIXED_W
    return [
      { label: "Genome browser SVG (current width)", onClick: () => saveSvg(width) },
      { label: "Genome browser SVG (standard width)", onClick: () => saveSvg(FIGURE_FIXED_W) },
      { label: "Genome browser PNG (current width)", onClick: () => savePng(width) },
      { label: "Genome browser PNG (standard width)", onClick: () => savePng(FIGURE_FIXED_W) },
    ]
  }, [buildFigure, plotWidth])

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
          genes={state.searchGenes}
          regionId={state.region?.gene_id ?? null}
          mode={state.mode}
          onModeChange={state.setMode}
          onSelectGene={state.selectRegionGene}
          onClearGene={state.clearRegion}
          onGoToLocus={state.goToLocus}
          onZoom={(factor) => state.view.zoomBy(factor)}
          settingsOpen={state.settingsOpen}
          onToggleSettings={state.toggleSettings}
          settingsRef={settingsRef}
          counterText=""
          onResetView={state.resetView}
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
                      // Keep lane and gene-track widths aligned when the scrollbar appears
                      scrollbarGutter: "stable",
                      "& > *:first-of-type": { mt: 0 },
                    }}
                  >
                    {state.groups.map((group, groupIndex) => (
                      <LaneGroup key={group.name}>
                        {group.members.map((track, trackIndex) => (
                          <TrackLane
                            key={track.track_id}
                            track={track}
                            data={state.coverage.get(track.track_id) ?? UNREAD}
                            chrom={state.region?.chrom ?? ""}
                            group={trackIndex === 0 ? group.name : undefined}
                            flush={groupIndex === 0 && trackIndex === 0}
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
                      </LaneGroup>
                    ))}

                    {state.prefs.showGwas && state.study && (
                      <LaneGroup>
                        <GwasTrack
                          study={state.study}
                          view={state.view}
                          chrom={state.region?.chrom ?? ""}
                          chromSize={state.chromSize}
                          covered={state.studyCovers}
                          width={plotWidth}
                          gutter={gutter}
                          grid={state.prefs.showGrid}
                          showSignificance={state.prefs.showSignificance}
                          isVisible={state.laneIsVisible}
                          watch={state.watchLane}
                          blockRef={gwasBlockRef}
                        />
                      </LaneGroup>
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
                      pickRef={geneTrackRef}
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
                  textAlign: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Search for a gene or enter a genomic location such as{" "}
                  <Box component="span" sx={{ fontFamily: custom.monoFontFamily }}>
                    chr:start-end
                  </Box>{" "}
                  to explore the surrounding region.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Drag to pan · ⌘/Ctrl + scroll to zoom · Shift-drag to select a range
                </Typography>
              </Box>
            )}

            {pick.picked?.kind === "gene" && (
              <BrowserGenePopup
                gene={pick.picked.gene}
                chrom={state.region?.chrom ?? ""}
                onReframe={state.reframeGene}
                onClose={pick.dismiss}
              />
            )}
            {pick.picked?.kind === "bin" && (
              <BinCoveragePanel
                base={pick.picked.base}
                chrom={state.region?.chrom ?? ""}
                range={pick.binRange}
                assays={pick.binAssays ?? []}
                onClose={pick.dismiss}
              />
            )}

            {state.settingsOpen && (
              <Popper
                open
                anchorEl={settingsRef.current}
                placement="bottom-start"
                modifiers={[
                  // Keep the panel below its button and within the card
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
