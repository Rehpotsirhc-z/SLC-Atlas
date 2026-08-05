// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react"
import { RESIDUES_REVEAL } from "./constants"

// A pointer leaving the viewer crosses the whole protein on its way to the figure, so the plot
// follows only a residue the pointer has come to rest on
export function useSettledResidue(residue: number | null): number | null {
  const [settled, setSettled] = useState(residue)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(residue), RESIDUES_REVEAL.settleMs)
    return () => window.clearTimeout(timer)
  }, [residue])

  return settled
}
