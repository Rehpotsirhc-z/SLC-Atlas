// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef } from "react"
import type { MouseEvent } from "react"
import { useTheme } from "@mui/material"
import { getFamilyColor } from "@/utils/familyColor"
import type { DendroLayout } from "@/utils/dendrogram"
import { GENE_LABEL_GAP, GENE_TREE_W, LEFT_W } from "./constants"
import type { GeneRow } from "./useGeneRows"

interface GeneSidebarProps {
  geneTree: DendroLayout | null
  geneRows: GeneRow[]
  familyFilter: string | null
  selectedGeneId: string | null
  selectedRow: number | null
  cellH: number
  geneFont: number
  geneDotR: number
  height: number
  onPick: (geneId: string | null) => void
}

export default function GeneSidebar({
  geneTree,
  geneRows,
  familyFilter,
  selectedGeneId,
  selectedRow,
  cellH,
  geneFont,
  geneDotR,
  height,
  onPick,
}: GeneSidebarProps) {
  const theme = useTheme()
  const mode = theme.palette.mode
  const monoFont = theme.custom.monoFontFamily
  const muted = theme.palette.text.secondary
  const paper = theme.palette.background.paper

  const selectedGeneIdRef = useRef(selectedGeneId)
  selectedGeneIdRef.current = selectedGeneId

  const renderGeneRow = useCallback(
    (g: GeneRow, i: number) => {
      const familyOpacity = familyFilter !== null && g.family !== familyFilter ? 0.25 : 1
      const color = getFamilyColor(g.family ?? "?", mode)
      const cy = i * cellH + cellH / 2
      return (
        <g
          key={g.geneId}
          style={{ cursor: "pointer" }}
          onClick={(e: MouseEvent) => {
            e.stopPropagation()
            onPick(g.geneId === selectedGeneIdRef.current ? null : g.geneId)
          }}
        >
          <circle cx={GENE_TREE_W} cy={cy} r={geneDotR} fill={paper} />
          <circle cx={GENE_TREE_W} cy={cy} r={geneDotR} fill={color} opacity={familyOpacity} />
          <text
            x={GENE_TREE_W + GENE_LABEL_GAP}
            y={cy + geneFont * 0.28}
            fontSize={geneFont}
            fontFamily={monoFont}
            fill={color}
            opacity={familyOpacity}
          >
            {g.symbol}
          </text>
        </g>
      )
    },
    [familyFilter, cellH, geneDotR, geneFont, mode, monoFont, paper, onPick],
  )

  const geneRowEls = useMemo(
    () => geneRows.map((g, i) => renderGeneRow(g, i)),
    [geneRows, renderGeneRow],
  )

  return (
    <svg width={LEFT_W} height={height} style={{ display: "block" }}>
      <path d={geneTree?.edges} stroke={muted} strokeWidth={0.7} fill="none" />
      <g opacity={selectedRow !== null ? 0.35 : 1}>{geneRowEls}</g>
      {selectedRow !== null && geneRows[selectedRow] && (
        <g>{renderGeneRow(geneRows[selectedRow], selectedRow)}</g>
      )}
    </svg>
  )
}
