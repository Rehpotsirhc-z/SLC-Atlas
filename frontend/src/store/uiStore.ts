import { create } from "zustand"

interface UIState {
  selectedGeneId: string | null
  setSelectedGeneId: (id: string | null) => void
}

export const useUIStore = create<UIState>()((set) => ({
  selectedGeneId: null,
  setSelectedGeneId: (id) => set({ selectedGeneId: id }),
}))
