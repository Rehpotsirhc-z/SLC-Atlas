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
}

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
    }),
    {
      name: "slc-atlas-ui",
      partialize: (state) => ({ themeMode: state.themeMode }),
    },
  ),
)
