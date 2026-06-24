// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ThemeMode } from "@/theme"

interface UIState {
  selectedGeneId: string | null
  setSelectedGeneId: (id: string | null) => void
  themeMode: ThemeMode
  toggleThemeMode: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedGeneId: null,
      setSelectedGeneId: (id) => set({ selectedGeneId: id }),
      themeMode: "light",
      toggleThemeMode: () => set((s) => ({ themeMode: s.themeMode === "dark" ? "light" : "dark" })),
    }),
    {
      name: "slc-atlas-ui",
      partialize: (state) => ({ themeMode: state.themeMode }),
    },
  ),
)
