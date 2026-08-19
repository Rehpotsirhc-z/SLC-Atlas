// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Apply shared settings after the store hydrates but before the first render

import { METRIC_ORDER, type TreeMetric, type TreeTissue } from "@/api/hooks/useClustering"
import {
  DEFAULT_PREFS,
  LANE_HEIGHT_MAX,
  LANE_HEIGHT_MIN,
  type BrowserPrefs,
  type GeneTrackMode,
} from "@/types/browser"
import {
  boolCodec,
  enumCodec,
  floatCodec,
  intCodec,
  listCodec,
  type ShareParamDescriptor,
} from "@/utils/shareCodecs"
import { arrivalHasAny, arrivalParam } from "@/utils/shareUrl"
import { overrideMode, overridePref } from "./browserOverrides"
import { useUIStore } from "./uiStore"

const TISSUES: TreeTissue[] = ["all", "brain"]

export const metricParam = (
  key: string,
  defaultValue: TreeMetric,
): ShareParamDescriptor<TreeMetric> => ({
  key,
  codec: enumCodec(METRIC_ORDER),
  defaultValue,
})

// Tissue affects co-expression metrics only
export const tissueParam = (
  key: string,
  metric?: TreeMetric,
): ShareParamDescriptor<TreeTissue> => ({
  key,
  codec: enumCodec(TISSUES),
  defaultValue: "all",
  isDefault: (value) => value === "all" || (metric !== undefined && metric !== "rna"),
})

type BrowserParams = { [K in keyof BrowserPrefs]: ShareParamDescriptor<BrowserPrefs[K]> }

export const browserPrefParams: BrowserParams = {
  laneHeight: {
    key: "lane",
    codec: intCodec(LANE_HEIGHT_MIN, LANE_HEIGHT_MAX),
    defaultValue: DEFAULT_PREFS.laneHeight,
  },
  yScale: { key: "y", codec: enumCodec(["auto", "shared", "fixed"]), defaultValue: "auto" },
  yFixed: { key: "ymax", codec: floatCodec, defaultValue: DEFAULT_PREFS.yFixed },
  showGwas: { key: "gwas", codec: boolCodec, defaultValue: true },
  showSignificance: { key: "sig", codec: boolCodec, defaultValue: true },
  showGrid: { key: "grid", codec: boolCodec, defaultValue: true },
  hidden: {
    key: "hide",
    codec: listCodec,
    defaultValue: DEFAULT_PREFS.hidden,
    isDefault: (value) => value.length === 0,
  },
}

export const browserModeParam: ShareParamDescriptor<GeneTrackMode> = {
  key: "mode",
  codec: enumCodec(["transcripts", "genes"]),
  defaultValue: "transcripts",
}

// Any browser parameter marks the URL as a complete snapshot
// Missing settings use defaults instead of saved preferences
export const BROWSER_KEYS = [
  "loc",
  browserModeParam.key,
  ...Object.values(browserPrefParams).map((d) => d.key),
]

function parsedArrival<T>(d: ShareParamDescriptor<T>): T | undefined {
  const raw = arrivalParam(d.key)
  if (raw === undefined) return undefined
  return d.codec.parse(raw)
}

function applyStoreParam<T>(d: ShareParamDescriptor<T>, toState: (value: T) => object) {
  const value = parsedArrival(d)
  if (value !== undefined) useUIStore.setState(toState(value))
}

// Preserve the saved preference separately from the temporary URL override
function snapshotPref<K extends keyof BrowserPrefs>(
  field: K,
  current: BrowserPrefs,
): BrowserPrefs[K] {
  overridePref(field, current[field])
  return parsedArrival(browserPrefParams[field]) ?? browserPrefParams[field].defaultValue
}

function applyBrowserArrival() {
  if (!arrivalHasAny(BROWSER_KEYS)) return
  const state = useUIStore.getState()
  const current = state.browserPrefs
  const browserPrefs: BrowserPrefs = {
    laneHeight: snapshotPref("laneHeight", current),
    yScale: snapshotPref("yScale", current),
    yFixed: snapshotPref("yFixed", current),
    showGwas: snapshotPref("showGwas", current),
    showSignificance: snapshotPref("showSignificance", current),
    showGrid: snapshotPref("showGrid", current),
    hidden: snapshotPref("hidden", current),
  }
  overrideMode(state.browserMode)
  const browserMode = parsedArrival(browserModeParam) ?? browserModeParam.defaultValue
  useUIStore.setState({ browserPrefs, browserMode })
}

export function applyShareArrival() {
  switch (window.location.pathname) {
    case "/clustering":
      applyStoreParam(metricParam("metric", "aa"), (v) => ({ clusteringMetric: v }))
      applyStoreParam(tissueParam("tissue"), (v) => ({ clusteringTissue: v }))
      break
    case "/conservation":
      applyStoreParam(metricParam("order", "ortho"), (v) => ({ treeMetric: v }))
      applyStoreParam(tissueParam("tissue"), (v) => ({ treeTissue: v }))
      break
    case "/expression":
      applyStoreParam(metricParam("order", "rna"), (v) => ({ expressionMetric: v }))
      applyStoreParam(tissueParam("tissue"), (v) => ({ expressionTissue: v }))
      break
    case "/browser":
      applyBrowserArrival()
      break
  }
}
