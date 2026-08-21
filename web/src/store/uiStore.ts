// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ThemeMode } from "@/theme"
import type { TreeMetric, TreeTissue } from "@/api/hooks/useClustering"
import { AUTO_CELL_SIZE, type CellSize } from "@/types/heatmap"
import type { PanelPos } from "@/utils/useDraggablePanel"
import { DEFAULT_PREFS, type BrowserPrefs, type GeneTrackMode } from "@/types/browser"
import { clearModeOverride, clearPrefOverrides, persistedBrowserState } from "./browserOverrides"
export type { PopupContent }
import type { PopupContent } from "@/types/popup"

export interface PanelSize {
  w: number
  h: number
}

interface UIState {
  selectedGeneId: string | null
  setSelectedGeneId: (id: string | null) => void
  treeMetric: TreeMetric
  setTreeMetric: (metric: TreeMetric) => void
  treeTissue: TreeTissue
  setTreeTissue: (tissue: TreeTissue) => void
  expressionMetric: TreeMetric
  setExpressionMetric: (metric: TreeMetric) => void
  expressionTissue: TreeTissue
  setExpressionTissue: (tissue: TreeTissue) => void
  clusteringMetric: TreeMetric
  setClusteringMetric: (metric: TreeMetric) => void
  clusteringTissue: TreeTissue
  setClusteringTissue: (tissue: TreeTissue) => void
  expressionCellSize: CellSize
  setExpressionCellSize: (next: Partial<CellSize>) => void
  conservationCellSize: CellSize
  setConservationCellSize: (next: Partial<CellSize>) => void
  themeMode: ThemeMode
  toggleThemeMode: () => void
  railOpen: boolean
  setRailOpen: (open: boolean) => void
  railWidth: number
  setRailWidth: (width: number) => void
  railFloating: boolean
  setRailFloating: (floating: boolean) => void
  railFloatPos: PanelPos | null
  setRailFloatPos: (pos: PanelPos) => void
  railFloatSize: PanelSize
  setRailFloatSize: (size: PanelSize) => void
  popupPos: PanelPos | null
  setPopupPos: (pos: PanelPos) => void
  popupSize: PanelSize | null
  setPopupSize: (size: PanelSize) => void
  popupContent: PopupContent | null
  setPopupContent: (content: PopupContent | null) => void
  anatomogramSex: "female" | "male"
  setAnatomogramSex: (sex: "female" | "male") => void
  browserPrefs: BrowserPrefs
  setBrowserPrefs: (next: Partial<BrowserPrefs>) => void
  browserMode: GeneTrackMode
  setBrowserMode: (mode: GeneTrackMode) => void
  aboutOpen: boolean
  setAboutOpen: (open: boolean) => void
  windowStack: string[]
  raiseWindow: (key: string) => void
}

export const RAIL_MIN_WIDTH = 220
export const RAIL_FLOAT_DEFAULT_SIZE: PanelSize = { w: 300, h: 480 }

const partializeUI = (state: UIState) => ({
  themeMode: state.themeMode,
  railOpen: state.railOpen,
  railWidth: state.railWidth,
  railFloating: state.railFloating,
  railFloatPos: state.railFloatPos,
  railFloatSize: state.railFloatSize,
  anatomogramSex: state.anatomogramSex,
  expressionCellSize: state.expressionCellSize,
  conservationCellSize: state.conservationCellSize,
  ...persistedBrowserState(state.browserPrefs, state.browserMode),
})
type PersistedUI = ReturnType<typeof partializeUI>

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedGeneId: null,
      setSelectedGeneId: (id) => set({ selectedGeneId: id }),
      treeMetric: "ortho",
      setTreeMetric: (metric) => set({ treeMetric: metric }),
      treeTissue: "all",
      setTreeTissue: (tissue) => set({ treeTissue: tissue }),
      expressionMetric: "rna",
      setExpressionMetric: (metric) => set({ expressionMetric: metric }),
      expressionTissue: "all",
      setExpressionTissue: (tissue) => set({ expressionTissue: tissue }),
      clusteringMetric: "aa",
      setClusteringMetric: (metric) => set({ clusteringMetric: metric }),
      clusteringTissue: "all",
      setClusteringTissue: (tissue) => set({ clusteringTissue: tissue }),
      expressionCellSize: AUTO_CELL_SIZE,
      setExpressionCellSize: (next) =>
        set((s) => ({ expressionCellSize: { ...s.expressionCellSize, ...next } })),
      conservationCellSize: AUTO_CELL_SIZE,
      setConservationCellSize: (next) =>
        set((s) => ({ conservationCellSize: { ...s.conservationCellSize, ...next } })),
      themeMode: "light",
      toggleThemeMode: () => set((s) => ({ themeMode: s.themeMode === "dark" ? "light" : "dark" })),
      railOpen: true,
      setRailOpen: (open) => set({ railOpen: open }),
      railWidth: 320,
      setRailWidth: (width) => set({ railWidth: Math.max(RAIL_MIN_WIDTH, width) }),
      railFloating: false,
      setRailFloating: (floating) => set({ railFloating: floating }),
      railFloatPos: null,
      setRailFloatPos: (pos) => set({ railFloatPos: pos }),
      railFloatSize: RAIL_FLOAT_DEFAULT_SIZE,
      setRailFloatSize: (size) => set({ railFloatSize: size }),
      popupPos: null,
      setPopupPos: (pos) => set({ popupPos: pos }),
      popupSize: null,
      setPopupSize: (size) => set({ popupSize: size }),
      popupContent: null,
      setPopupContent: (content) => set({ popupContent: content }),
      anatomogramSex: "female",
      setAnatomogramSex: (sex) => set({ anatomogramSex: sex }),
      browserPrefs: DEFAULT_PREFS,
      setBrowserPrefs: (next) => {
        clearPrefOverrides(Object.keys(next) as (keyof BrowserPrefs)[])
        set((s) => ({ browserPrefs: { ...s.browserPrefs, ...next } }))
      },
      browserMode: "transcripts",
      setBrowserMode: (mode) => {
        clearModeOverride()
        set({ browserMode: mode })
      },
      aboutOpen: false,
      setAboutOpen: (open) => set({ aboutOpen: open }),
      windowStack: [],
      raiseWindow: (key) =>
        set((s) =>
          s.windowStack[s.windowStack.length - 1] === key
            ? s
            : { windowStack: [...s.windowStack.filter((k) => k !== key), key] },
        ),
    }),
    {
      name: "atlas-ui",
      version: 1,
      partialize: partializeUI,
      migrate: (persisted) => persisted as PersistedUI,
      // Add defaults missing from state saved by older builds
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<UIState>
        return {
          ...current,
          ...stored,
          browserPrefs: { ...DEFAULT_PREFS, ...stored.browserPrefs },
        }
      },
    },
  ),
)
