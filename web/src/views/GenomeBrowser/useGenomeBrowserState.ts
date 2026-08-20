// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react"
import { useTheme } from "@mui/material"
import { useBrowserGenes, useRegion, useTrackManifest } from "@/api/hooks/useBrowser"
import { useUIStore } from "@/store/uiStore"
import {
  DEFAULT_PREFS,
  type BrowserGene,
  type Chrom,
  type CoverageTrack,
  type GeneTrackMode,
  type Region,
} from "@/types/browser"
import { TRANSCRIPT_MAX_SPAN, Y_HEADROOM } from "./constants"
import { useArrivalLocus } from "./useArrivalLocus"
import { useBrowserMirror } from "./useBrowserMirror"
import { chromNames } from "./chromNames"
import { peakInView } from "./drawCoverage"
import { rowGap } from "./geneLayout"
import type { Viewport } from "./scale"
import { trackColors } from "./trackColor"
import { useBrowserView } from "./useBrowserView"
import { summaryStep, useCoverageBlock, useCoverageData } from "./useCoverageData"
import { useGeneModels } from "./useFeatureData"
import { useLaneVisibility } from "./useLaneVisibility"
import { useWarmReaders } from "./useWarmReaders"

const NO_TRACKS: CoverageTrack[] = []
const NO_CHROMS: Chrom[] = []
const NO_BROWSER_GENES: BrowserGene[] = []
const NOWHERE: Viewport = { start: 0, end: 1 }

export function useGenomeBrowserState(frameRef: RefObject<HTMLElement | null>, plotWidth: number) {
  const { palette } = useTheme()
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)

  const prefs = useUIStore((s) => s.browserPrefs)
  const updatePrefs = useUIStore((s) => s.setBrowserPrefs)
  const mode = useUIStore((s) => s.browserMode)
  const setMode = useUIStore((s) => s.setBrowserMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingLocus, setPendingLocus] = useState<(Viewport & { chrom: string }) | null>(null)

  const manifestQuery = useTrackManifest()
  const browserGenesQuery = useBrowserGenes()

  const browserGenes = browserGenesQuery.data ?? NO_BROWSER_GENES
  const study = manifestQuery.data?.studies[0]
  const chroms = manifestQuery.data?.chroms ?? NO_CHROMS
  const names = useMemo(() => chromNames(chroms), [chroms])

  const [regionGeneId, setRegionGeneId] = useState<string | null>(selectedGeneId)
  useEffect(() => {
    if (selectedGeneId) setRegionGeneId(selectedGeneId)
  }, [selectedGeneId])

  const regionGene = useMemo(
    () => browserGenes.find((gene) => gene.gene_id === regionGeneId) ?? null,
    [browserGenes, regionGeneId],
  )
  const isNeighbor = regionGene != null && !regionGene.is_atlas
  const regionQuery = useRegion(isNeighbor ? null : regionGeneId)

  const region: Region | undefined = useMemo(() => {
    if (!isNeighbor || !regionGene) return regionQuery.data
    const chrom = chroms.find((c) => c.chrom === regionGene.chrom)
    if (!chrom) return undefined
    return {
      gene_id: regionGene.gene_id,
      symbol: regionGene.symbol,
      chrom: regionGene.chrom,
      chrom_ensembl: chrom.ensembl,
      chrom_size: chrom.size,
      gene_start: regionGene.window_start,
      gene_end: regionGene.window_end,
      strand: null,
      window_start: regionGene.window_start,
      window_end: regionGene.window_end,
      pan_start: 0,
      pan_end: chrom.size,
      flank: 0,
      clipped: false,
    }
  }, [isNeighbor, regionGene, regionQuery.data, chroms])

  const allTracks = manifestQuery.data?.tracks ?? NO_TRACKS
  const tracks = useMemo(
    () => allTracks.filter((track) => !prefs.hidden.includes(track.track_id)),
    [allTracks, prefs.hidden],
  )

  // Which lanes are on screen, which is both what gets repainted and whose bytes are read first
  const lanes = useLaneVisibility(frameRef)

  useWarmReaders(tracks, chroms, study?.study_id ?? null)

  const colors = useMemo(
    () =>
      trackColors(
        allTracks.map((track) => track.label),
        palette.mode,
      ),
    [allTracks, palette.mode],
  )

  const initial = useMemo<Viewport>(
    () => (region ? { start: region.window_start, end: region.window_end } : NOWHERE),
    [region],
  )
  const chromSize = region ? (region.chrom_size ?? region.pan_end) : 0
  // The whole chromosome, not the gene's own window: a slice carries every window the family
  // has on it, so traveling out of one locus and into the next is a pan rather than a search
  const bounds = useMemo<Viewport>(
    () => (region ? { start: 0, end: chromSize } : NOWHERE),
    [region, chromSize],
  )

  const view = useBrowserView(initial, bounds)

  const block = useCoverageBlock(view.view, region?.chrom, chromSize)
  // What one column of the view covers, which decides whether a track is read whole or summarized
  const step = summaryStep(view.view, plotWidth)
  const coverage = useCoverageData(tracks, region?.chrom, block, lanes.isVisible, step)

  const models = useGeneModels(region?.chrom, block)
  // Keep row spacing stable while panning at the same zoom level
  const modelGap = rowGap(view.view, plotWidth)
  // A view too wide to tell one exon from another draws gene bodies whatever the toolbar says,
  // since a chromosome carries tens of thousands of transcripts and none of them would read
  const drawn: GeneTrackMode =
    mode === "transcripts" && view.view.end - view.view.start > TRANSCRIPT_MAX_SPAN ? "genes" : mode
  // Only the shared mode needs every lane measured together, and it is worked out where the
  // view has settled rather than inside a frame
  const sharedMax = useMemo(() => {
    if (prefs.yScale !== "shared") return null
    let peak = 0
    for (const lane of coverage.values()) {
      peak = Math.max(peak, peakInView(lane.plus, view.view))
      if (lane.minus) peak = Math.max(peak, peakInView(lane.minus, view.view))
    }
    return peak > 0 ? peak * Y_HEADROOM : 1
  }, [prefs.yScale, coverage, view.view])

  const yMaxFor = useCallback((): number | null => {
    if (prefs.yScale === "fixed") return prefs.yFixed
    if (prefs.yScale === "shared") return sharedMax
    return null
  }, [prefs.yScale, prefs.yFixed, sharedMax])

  const groups = useMemo(() => {
    const byGroup = new Map<string, CoverageTrack[]>()
    for (const track of tracks) {
      const held = byGroup.get(track.group)
      if (held) held.push(track)
      else byGroup.set(track.group, [track])
    }
    return [...byGroup.entries()].map(([name, members]) => ({ name, members }))
  }, [tracks])

  const selectRegionGene = useCallback(
    (geneId: string) => {
      const gene = browserGenes.find((candidate) => candidate.gene_id === geneId)
      // Update the browser even when the cross-view family selection is unchanged
      setRegionGeneId(geneId)
      if (!gene || gene.is_atlas) setSelectedGeneId(geneId)
    },
    [browserGenes, setSelectedGeneId],
  )

  const clearRegion = useCallback(() => {
    setRegionGeneId(null)
    setSelectedGeneId(null)
  }, [setSelectedGeneId])

  // Unlisted genes have no manifest window, so frame their model span directly
  const reframeGene = useCallback(
    (geneId: string, start: number, end: number) => {
      if (browserGenes.some((gene) => gene.gene_id === geneId)) selectRegionGene(geneId)
      else view.goTo({ start, end })
    },
    [browserGenes, selectRegionGene, view],
  )

  const resetView = useCallback(() => {
    const current = view.liveView()
    if (current.start !== initial.start || current.end !== initial.end) {
      view.reset()
      return
    }
    clearRegion()
  }, [view, initial, clearRegion])

  const goToLocus = useCallback(
    (locus: { chrom: string; start: number; end: number }) => {
      const track = names.track(locus.chrom)
      if (track === null) return
      if (region && track === region.chrom) {
        view.goTo({ start: locus.start, end: locus.end })
        return
      }
      const middle = (locus.start + locus.end) / 2
      let nearest: BrowserGene | null = null
      let best = Infinity
      for (const gene of browserGenes) {
        if (gene.chrom !== track) continue
        const distance = Math.abs((gene.window_start + gene.window_end) / 2 - middle)
        if (distance < best) [best, nearest] = [distance, gene]
      }
      if (!nearest) return
      selectRegionGene(nearest.gene_id)
      setPendingLocus({ ...locus, chrom: track })
    },
    [region, view, browserGenes, names, selectRegionGene],
  )

  useEffect(() => {
    if (!pendingLocus || !region || region.chrom !== pendingLocus.chrom) return
    view.goTo({ start: pendingLocus.start, end: pendingLocus.end })
    setPendingLocus(null)
  }, [pendingLocus, region, view])

  useArrivalLocus({
    ready: manifestQuery.data != null && browserGenesQuery.data != null,
    names,
    browserGenes,
    goToLocus,
    setPendingLocus,
  })

  useBrowserMirror({
    prefs,
    mode,
    region,
    committed: view.view,
    moving: view.moving,
    liveView: view.liveView,
  })

  const restoreDefaults = useCallback(() => {
    updatePrefs(DEFAULT_PREFS)
    setMode("transcripts")
  }, [updatePrefs, setMode])

  const toggleSettings = useCallback(() => setSettingsOpen((open) => !open), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const studyCovers = study && region ? study.chroms.includes(region.chrom) : false

  return {
    searchGenes: browserGenes,
    selectRegionGene,
    reframeGene,
    clearRegion,
    resetView,
    selectedGeneId,
    setSelectedGeneId,
    region,
    names,
    study,
    studyCovers,
    chromSize,
    laneIsVisible: lanes.isVisible,
    models,
    modelGap,
    allTracks,
    tracks,
    groups,
    colors,
    coverage,
    watchLane: lanes.watch,
    view,
    prefs,
    updatePrefs,
    restoreDefaults,
    yMaxFor,
    mode,
    drawn,
    setMode,
    settingsOpen,
    toggleSettings,
    closeSettings,
    goToLocus,
    loading:
      manifestQuery.isPending ||
      browserGenesQuery.isPending ||
      (!isNeighbor && regionGeneId != null && regionQuery.isPending),
    error: manifestQuery.error ?? regionQuery.error ?? browserGenesQuery.error,
  }
}
