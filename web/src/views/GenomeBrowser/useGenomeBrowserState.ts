// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react"
import { useTheme } from "@mui/material"
import { useGenes } from "@/api/hooks/useGenes"
import { useRegion, useTrackManifest } from "@/api/hooks/useBrowser"
import { useUIStore } from "@/store/uiStore"
import type { Chrom, CoverageTrack, Region } from "@/types/browser"
import type { Gene } from "@/types/gene"
import { DEFAULT_PREFS, type BrowserPrefs } from "./BrowserSettings"
import type { GeneTrackMode } from "./GeneTrack"
import { TRANSCRIPT_MAX_SPAN } from "./constants"
import { chromNames } from "./chromNames"
import { peakInView } from "./drawCoverage"
import { rowGap } from "./geneLayout"
import type { Viewport } from "./scale"
import { trackColors } from "./trackColor"
import { useBrowserView } from "./useBrowserView"
import { summaryStep, useCoverageBlock, useCoverageData } from "./useCoverageData"
import { useGeneModels, useVisibleGwas } from "./useFeatureData"
import { useLaneVisibility } from "./useLaneVisibility"
import { useWarmReaders } from "./useWarmReaders"

const NO_TRACKS: CoverageTrack[] = []
const NO_CHROMS: Chrom[] = []
const NO_GENES: Gene[] = []
const NOWHERE: Viewport = { start: 0, end: 1 }

export function useGenomeBrowserState(frameRef: RefObject<HTMLElement | null>, plotWidth: number) {
  const { palette } = useTheme()
  const selectedGeneId = useUIStore((s) => s.selectedGeneId)
  const setSelectedGeneId = useUIStore((s) => s.setSelectedGeneId)

  const [prefs, setPrefs] = useState<BrowserPrefs>(DEFAULT_PREFS)
  const [mode, setMode] = useState<GeneTrackMode>("transcripts")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingLocus, setPendingLocus] = useState<(Viewport & { chrom: string }) | null>(null)

  const genesQuery = useGenes()
  const manifestQuery = useTrackManifest()
  const regionQuery = useRegion(selectedGeneId)

  const region: Region | undefined = regionQuery.data
  const study = manifestQuery.data?.studies[0]
  const genes = genesQuery.data ?? NO_GENES

  const allTracks = manifestQuery.data?.tracks ?? NO_TRACKS
  const tracks = useMemo(
    () => allTracks.filter((track) => !prefs.hidden.includes(track.track_id)),
    [allTracks, prefs.hidden],
  )

  const chroms = manifestQuery.data?.chroms ?? NO_CHROMS
  const names = useMemo(() => chromNames(chroms), [chroms])

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
  // has on it, so travelling out of one locus and into the next is a pan rather than a search
  const bounds = useMemo<Viewport>(
    () => (region ? { start: 0, end: chromSize } : NOWHERE),
    [region, chromSize],
  )

  const view = useBrowserView(initial, bounds)

  const block = useCoverageBlock(view.view, region?.chrom, chromSize)
  // What one column of the view covers, which decides whether a track is read whole or summarised
  const step = summaryStep(view.view, plotWidth)
  const coverage = useCoverageData(tracks, region?.chrom, block, lanes.isVisible, step)

  const models = useGeneModels(region?.chrom, block)
  // Keep row spacing stable while panning at the same zoom level
  const modelGap = rowGap(view.view, plotWidth)
  // A view too wide to tell one exon from another draws gene bodies whatever the toolbar says,
  // since a chromosome carries tens of thousands of transcripts and none of them would read
  const drawn: GeneTrackMode =
    mode === "transcripts" && view.view.end - view.view.start > TRANSCRIPT_MAX_SPAN ? "genes" : mode
  const gwas = useVisibleGwas(
    region?.chrom,
    block,
    view.view,
    study?.study_id ?? null,
    lanes.isVisible,
  )

  // Only the shared mode needs every lane measured together, and it is worked out where the
  // view has settled rather than inside a frame
  const sharedMax = useMemo(() => {
    if (prefs.yScale !== "shared") return null
    let peak = 0
    for (const lane of coverage.values()) {
      peak = Math.max(peak, peakInView(lane.plus, view.view))
      if (lane.minus) peak = Math.max(peak, peakInView(lane.minus, view.view))
    }
    return peak > 0 ? peak * 1.08 : 1
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

  /**
   * A coordinate on the chromosome already in view is just a move. One elsewhere needs a gene
   * on that chromosome first, because the chromosome's length and its windows come with a
   * region, and the view lands on the coordinate once that arrives.
   */
  const goToLocus = useCallback(
    (locus: { chrom: string; start: number; end: number }) => {
      const track = names.track(locus.chrom)
      if (track === null) return
      if (region && track === region.chrom) {
        view.goTo({ start: locus.start, end: locus.end })
        return
      }
      const ensembl = names.ensembl(locus.chrom)
      const onChrom = genes.filter((gene) => gene.chromosome === ensembl)
      if (onChrom.length === 0) return
      const middle = (locus.start + locus.end) / 2
      const nearest = onChrom.reduce((best, gene) =>
        Math.abs((gene.start + gene.end) / 2 - middle) <
        Math.abs((best.start + best.end) / 2 - middle)
          ? gene
          : best,
      )
      setSelectedGeneId(nearest.id)
      setPendingLocus({ ...locus, chrom: track })
    },
    [region, view, genes, names, setSelectedGeneId],
  )

  useEffect(() => {
    if (!pendingLocus || !region || region.chrom !== pendingLocus.chrom) return
    view.goTo({ start: pendingLocus.start, end: pendingLocus.end })
    setPendingLocus(null)
  }, [pendingLocus, region, view])

  const updatePrefs = useCallback(
    (next: Partial<BrowserPrefs>) => setPrefs((current) => ({ ...current, ...next })),
    [],
  )

  const toggleSettings = useCallback(() => setSettingsOpen((open) => !open), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const studyCovers = study && region ? study.chroms.includes(region.chrom) : false

  return {
    genes,
    selectedGeneId,
    setSelectedGeneId,
    region,
    study,
    studyCovers,
    gwasPoints: gwas.points,
    gwasLoading: gwas.loading,
    gwasThinned: gwas.thinned,
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
    yMaxFor,
    mode,
    drawn,
    setMode,
    settingsOpen,
    toggleSettings,
    closeSettings,
    goToLocus,
    loading: manifestQuery.isPending || (selectedGeneId != null && regionQuery.isPending),
    error: manifestQuery.error ?? regionQuery.error,
  }
}
