// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { create } from "zustand"

interface UIState {
  selectedGeneId: string | null
  setSelectedGeneId: (id: string | null) => void
}

export const useUIStore = create<UIState>()((set) => ({
  selectedGeneId: null,
  setSelectedGeneId: (id) => set({ selectedGeneId: id }),
}))
