// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Restore a shared locus after browser data and the global gene selection are ready

import { useEffect, useRef, useSyncExternalStore } from "react"
import { useUIStore } from "@/store/uiStore"
import type { BrowserGene } from "@/types/browser"
import {
  arrivalParam,
  clearShareParam,
  geneArrivalSettled,
  subscribeGeneArrival,
} from "@/utils/shareUrl"
import type { ChromNames } from "./chromNames"
import { parseLocus, type Locus } from "./LocusSearch"
import type { Viewport } from "./scale"
import { ARRIVAL_POINT_SPAN } from "./constants"

interface Args {
  ready: boolean
  names: ChromNames
  browserGenes: BrowserGene[]
  goToLocus: (locus: Locus) => void
  setPendingLocus: (locus: (Viewport & { chrom: string }) | null) => void
}

export function useArrivalLocus({ ready, names, browserGenes, goToLocus, setPendingLocus }: Args) {
  const geneSettled = useSyncExternalStore(subscribeGeneArrival, geneArrivalSettled)
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !ready || !geneSettled) return
    done.current = true
    const raw = arrivalParam("loc")
    if (raw === undefined) return
    const locus = parseLocus(raw, ARRIVAL_POINT_SPAN)
    const track = locus ? names.track(locus.chrom) : null
    if (!locus || track === null) {
      clearShareParam("loc")
      return
    }
    // Reuse the selected gene's region when it is on the same chromosome
    const anchorId = useUIStore.getState().selectedGeneId
    const anchor = anchorId ? browserGenes.find((gene) => gene.gene_id === anchorId) : undefined
    if (anchor && anchor.chrom === track) {
      setPendingLocus({ start: locus.start, end: locus.end, chrom: track })
    } else {
      goToLocus(locus)
    }
  }, [ready, geneSettled, names, browserGenes, goToLocus, setPendingLocus])
}
