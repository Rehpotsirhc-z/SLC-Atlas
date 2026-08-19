// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Always include loc so shared browser URLs use defaults instead of saved settings

import { useEffect, useMemo } from "react"
import { browserModeParam, browserPrefParams } from "@/store/shareArrival"
import type { BrowserPrefs, GeneTrackMode, Region } from "@/types/browser"
import type { ShareParamDescriptor } from "@/utils/shareCodecs"
import { clearShareParam, setShareParam } from "@/utils/shareUrl"
import { useShareMirror } from "@/utils/useShareParam"
import { VIEW_REST_MS } from "./constants"
import type { Viewport } from "./scale"

interface Args {
  prefs: BrowserPrefs
  mode: GeneTrackMode
  region: Region | undefined
  committed: Viewport
  moving: () => boolean
  liveView: () => Viewport
}

export function useBrowserMirror({ prefs, mode, region, committed, moving, liveView }: Args) {
  useShareMirror(browserModeParam, mode)
  useShareMirror(browserPrefParams.laneHeight, prefs.laneHeight)
  useShareMirror(browserPrefParams.yScale, prefs.yScale)
  useShareMirror(browserPrefParams.showGwas, prefs.showGwas)
  useShareMirror(browserPrefParams.showSignificance, prefs.showSignificance)
  useShareMirror(browserPrefParams.showGrid, prefs.showGrid)
  useShareMirror(browserPrefParams.hidden, prefs.hidden)

  // Share the fixed maximum only when fixed scaling is active
  const yFixedParam = useMemo<ShareParamDescriptor<number>>(
    () => ({
      ...browserPrefParams.yFixed,
      isDefault: (value) =>
        prefs.yScale !== "fixed" || value === browserPrefParams.yFixed.defaultValue,
    }),
    [prefs.yScale],
  )
  useShareMirror(yFixedParam, prefs.yFixed)

  // Wait for navigation to settle before updating the URL
  useEffect(() => {
    if (!region) {
      clearShareParam("loc")
      return
    }
    const timer = window.setTimeout(() => {
      if (moving()) return
      const live = liveView()
      const start = Math.round(live.start) + 1
      const end = Math.round(live.end)
      setShareParam("loc", `${region.chrom}:${start}-${end}`)
    }, VIEW_REST_MS)
    return () => clearTimeout(timer)
  }, [region, committed, moving, liveView])

  useEffect(() => () => clearShareParam("loc"), [])
}
