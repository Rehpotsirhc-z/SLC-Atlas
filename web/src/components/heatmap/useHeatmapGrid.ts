// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from "react"
import { LEFT_COL_W, RIGHT_PAD } from "./constants"
import type { CellPos } from "./types"
import type { GeneRow } from "./useGeneRows"

interface HeatmapGridOptions<C, T> {
  cells: C[]
  cellKey: (cell: C) => string
  cols: T[]
  colKey: (col: T) => string
  geneRows: GeneRow[]
  rowByGene: Map<string, number>
  cellW: number
  cellH: number
  containerW: number
  legendReserve: number
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
}

export function useHeatmapGrid<C, T>({
  cells,
  cellKey,
  cols,
  colKey,
  geneRows,
  rowByGene,
  cellW,
  cellH,
  containerW,
  legendReserve,
  familyFilter,
  selectedGeneId,
  onSelect,
}: HeatmapGridOptions<C, T>) {
  const [selectedCell, setSelectedCell] = useState<CellPos | null>(null)

  const cellMap = useMemo(() => {
    const m = new Map<string, C>()
    for (const c of cells) m.set(cellKey(c), c)
    return m
  }, [cells, cellKey])

  const matrix = useMemo(
    () => geneRows.map((g) => cols.map((c) => cellMap.get(`${g.geneId}__${colKey(c)}`))),
    [geneRows, cols, colKey, cellMap],
  )

  const gridW = cols.length * cellW
  const gridH = geneRows.length * cellH
  const contentW = LEFT_COL_W + gridW + RIGHT_PAD + legendReserve
  const fits = containerW > 0 && contentW <= containerW
  const selectedRow = selectedGeneId ? (rowByGene.get(selectedGeneId) ?? null) : null
  const selectedCol =
    selectedCell !== null && selectedCell.row === selectedRow ? selectedCell.col : null
  const selectedOutline =
    selectedRow !== null && selectedCol !== null ? { row: selectedRow, col: selectedCol } : null

  const rowAlpha = useCallback(
    (r: number) => {
      let a = familyFilter !== null && geneRows[r].family !== familyFilter ? 0.15 : 1
      if (selectedRow !== null && r !== selectedRow) a *= 0.3
      return a
    },
    [familyFilter, geneRows, selectedRow],
  )

  const pickGene = useCallback(
    (geneId: string | null) => {
      onSelect(geneId)
      setSelectedCell(null)
    },
    [onSelect],
  )

  const toggleCell = useCallback(
    (hit: CellPos) => {
      const deselecting =
        selectedCell !== null && selectedCell.row === hit.row && selectedCell.col === hit.col
      if (deselecting) {
        onSelect(null)
        setSelectedCell(null)
      } else {
        onSelect(geneRows[hit.row].geneId)
        setSelectedCell(hit)
      }
    },
    [selectedCell, geneRows, onSelect],
  )

  return {
    matrix,
    gridW,
    gridH,
    contentW,
    fits,
    selectedRow,
    selectedOutline,
    rowAlpha,
    pickGene,
    toggleCell,
  }
}
