// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ThemeMode } from "@/theme"
import type { TreeMetric, TreeTissue } from "@/api/hooks/useClustering"

interface UIState {
  selectedGeneId: string | null
  setSelectedGeneId: (id: string | null) => void
  treeMetric: TreeMetric
  setTreeMetric: (metric: TreeMetric) => void
  treeTissue: TreeTissue
  setTreeTissue: (tissue: TreeTissue) => void
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
  anatomogramSex: "female" | "male"
  setAnatomogramSex: (sex: "female" | "male") => void
}

export const RAIL_MIN_WIDTH = 150

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedGeneId: null,
      setSelectedGeneId: (id) => set({ selectedGeneId: id }),
      treeMetric: "ortho",
      setTreeMetric: (metric) => set({ treeMetric: metric }),
      treeTissue: "all",
      setTreeTissue: (tissue) => set({ treeTissue: tissue }),
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
      anatomogramSex: "female",
      setAnatomogramSex: (sex) => set({ anatomogramSex: sex }),
    }),
    {
      name: "slc-atlas-ui",
      partialize: (state) => ({
        themeMode: state.themeMode,
        railOpen: state.railOpen,
        railWidth: state.railWidth,
        anatomogramSex: state.anatomogramSex,
      }),
    },
  ),
)
