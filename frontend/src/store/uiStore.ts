// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ThemeMode } from "@/theme"
import type { TreeMetric, TreeTissue } from "@/api/hooks/useClustering"
import type { PanelPos } from "@/utils/useDraggablePanel"

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
  anatomogramSex: "female" | "male"
  setAnatomogramSex: (sex: "female" | "male") => void
}

export const RAIL_MIN_WIDTH = 220
export const RAIL_FLOAT_DEFAULT_SIZE: PanelSize = { w: 300, h: 480 }

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
      anatomogramSex: "female",
      setAnatomogramSex: (sex) => set({ anatomogramSex: sex }),
    }),
    {
      name: "slc-atlas-ui",
      partialize: (state) => ({
        themeMode: state.themeMode,
        railOpen: state.railOpen,
        railWidth: state.railWidth,
        railFloating: state.railFloating,
        railFloatPos: state.railFloatPos,
        railFloatSize: state.railFloatSize,
        anatomogramSex: state.anatomogramSex,
      }),
    },
  ),
)
