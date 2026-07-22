// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMediaQuery } from "@mui/material"
import { RAIL_MIN_WIDTH, useUIStore } from "@/store/uiStore"
import type { ExpressionRow } from "@/types/expression"
import { useElementSize } from "@/utils/useElementSize"
import type { RailView } from "./Anatomograms"
import {
  MIN_MAIN_CONTENT_WIDTH,
  RAIL_EDGE_WIDTH,
  TISSUE_FLASH_MS,
  TISSUE_FLASH_MS_REDUCED,
} from "./constants"

interface Options {
  tissue: "all" | "brain"
  selectedRows: ExpressionRow[] | null
  onFocusTissue: (tissues: string[]) => void
}

export function useExpressionRail({ tissue, selectedRows, onFocusTissue }: Options) {
  const railOpen = useUIStore((s) => s.railOpen)
  const setRailOpen = useUIStore((s) => s.setRailOpen)
  const railWidth = useUIStore((s) => s.railWidth)
  const setRailWidth = useUIStore((s) => s.setRailWidth)
  const railFloating = useUIStore((s) => s.railFloating)
  const setRailFloating = useUIStore((s) => s.setRailFloating)
  const anatomogramSex = useUIStore((s) => s.anatomogramSex)
  const setAnatomogramSex = useUIStore((s) => s.setAnatomogramSex)

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [railTissue, setRailTissue] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pickTissue = useCallback(
    (tissues: string[]) => {
      if (flashTimer.current) clearTimeout(flashTimer.current)
      setRailTissue(tissues[0] ?? null)
      onFocusTissue(tissues)
      flashTimer.current = setTimeout(
        () => setRailTissue(null),
        reduceMotion ? TISSUE_FLASH_MS_REDUCED : TISSUE_FLASH_MS,
      )
    },
    [reduceMotion, onFocusTissue],
  )

  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), [])

  const [rowRef, { w: rowWidth }] = useElementSize<HTMLDivElement>("content")
  const [fillWidth, setFillWidth] = useState(Infinity)

  const maxAutoWidth = Math.max(
    RAIL_MIN_WIDTH,
    rowWidth - MIN_MAIN_CONTENT_WIDTH - RAIL_EDGE_WIDTH,
  )
  const effWidth = Math.min(Math.max(railWidth, RAIL_MIN_WIDTH), fillWidth, maxAutoWidth)

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = effWidth
      const onMove = (ev: PointerEvent) => setRailWidth(startW + (startX - ev.clientX))
      const onUp = () => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [effWidth, setRailWidth],
  )

  const tpmByTissue = useMemo(
    () => (selectedRows ? new Map(selectedRows.map((r) => [r.tissue, r.tpm])) : null),
    [selectedRows],
  )

  const domainMax = useMemo(() => {
    if (!selectedRows) return 1
    let m = 0
    for (const r of selectedRows) m = Math.max(m, Math.log2(r.tpm + 1))
    return m || 1
  }, [selectedRows])

  const view: RailView = tissue === "brain" ? "brain" : anatomogramSex

  return {
    rowRef,
    view,
    railOpen,
    setRailOpen,
    railFloating,
    setRailFloating,
    setAnatomogramSex,
    railTissue,
    pickTissue,
    effWidth,
    maxAutoWidth,
    setRailWidth,
    setFillWidth,
    startResize,
    tpmByTissue,
    domainMax,
    reduceMotion,
  }
}
