// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import { alpha, useTheme } from "@mui/material/styles"
import ColumnLabels, { ColumnLabel } from "@/components/heatmap/ColumnLabels"
import { COL_LABEL_GAP, RIGHT_PAD } from "@/components/heatmap/constants"
import { displayTissue } from "@/utils/tissue"

interface TissueColumnHeaderProps {
  tissueCols: string[]
  cellW: number
  gridW: number
  topH: number
  font: number
  onTissueClick?: (tissue: string) => void
}

export default function TissueColumnHeader({
  tissueCols,
  cellW,
  gridW,
  topH,
  font,
  onTissueClick,
}: TissueColumnHeaderProps) {
  const theme = useTheme()
  const monoFont = theme.custom.monoFontFamily
  const muted = theme.palette.text.secondary
  const accent = theme.palette.secondary.main
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  const labels = useMemo(
    () => tissueCols.map((t) => ({ key: t, text: displayTissue(t) })),
    [tissueCols],
  )

  const hitRects = useMemo(
    () =>
      onTissueClick &&
      tissueCols.map((t, i) => (
        <rect
          key={`hit-${t}`}
          x={i * cellW}
          y={0}
          width={cellW}
          height={topH}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation()
            onTissueClick(t)
          }}
          onPointerEnter={(e) => e.pointerType !== "touch" && setHoverCol(i)}
          onPointerLeave={() => setHoverCol((c) => (c === i ? null : c))}
        />
      )),
    [tissueCols, cellW, topH, onTissueClick],
  )

  const hovered = hoverCol !== null ? labels[hoverCol] : undefined

  return (
    <svg width={gridW + RIGHT_PAD} height={topH} style={{ display: "block", overflow: "visible" }}>
      {hitRects}
      <ColumnLabels
        labels={labels}
        cellW={cellW}
        y={COL_LABEL_GAP}
        font={font}
        fontFamily={monoFont}
        fill={muted}
      />
      {hoverCol !== null && hovered && (
        <g style={{ pointerEvents: "none" }}>
          <rect x={hoverCol * cellW} y={0} width={cellW} height={topH} fill={alpha(accent, 0.12)} />
          <ColumnLabel
            text={hovered.text}
            index={hoverCol}
            cellW={cellW}
            y={COL_LABEL_GAP}
            font={font}
            fontFamily={monoFont}
            fill={accent}
            fontWeight={600}
          />
        </g>
      )}
    </svg>
  )
}
