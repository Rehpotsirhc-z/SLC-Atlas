// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useMemo } from "react"
import { Box, useTheme } from "@mui/material"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ColumnLabels from "@/components/heatmap/ColumnLabels"
import { COL_LABEL_GAP, LEFT_COL_W, RIGHT_PAD } from "@/components/heatmap/constants"
import type { DendroLayout } from "@/utils/dendrogram"
import { SP_TREE_PAD, SPECIES_LABEL_H, SPECIES_TOGGLE_H, SPECIES_TREE_H } from "./constants"
import type { SpeciesCol } from "./useConservationMatrix"

interface SpeciesHeaderProps {
  speciesTree: DendroLayout | null
  speciesCols: SpeciesCol[]
  gridW: number
  cellW: number
  font: number
  fits: boolean
  containerW: number
  showSpeciesTree: boolean
  onToggleSpeciesTree?: () => void
}

const SpeciesHeader = memo(function SpeciesHeader({
  speciesTree,
  speciesCols,
  gridW,
  cellW,
  font,
  fits,
  containerW,
  showSpeciesTree,
  onToggleSpeciesTree,
}: SpeciesHeaderProps) {
  const theme = useTheme()
  const monoFont = theme.custom.monoFontFamily
  const muted = theme.palette.text.secondary

  const labels = useMemo(
    () => speciesCols.map((s) => ({ key: s.species, text: s.label })),
    [speciesCols],
  )

  return (
    <Box sx={{ position: "relative", display: "flex", flexDirection: "column" }}>
      {showSpeciesTree && (
        <svg width={gridW} height={SPECIES_TREE_H} style={{ display: "block" }}>
          <path
            transform={`translate(0 ${SP_TREE_PAD})`}
            d={speciesTree?.edges}
            stroke={muted}
            strokeWidth={0.7}
            fill="none"
          />
        </svg>
      )}
      <svg
        width={gridW + RIGHT_PAD}
        height={SPECIES_LABEL_H}
        style={{ display: "block", overflow: "visible" }}
      >
        <ColumnLabels
          labels={labels}
          cellW={cellW}
          y={COL_LABEL_GAP}
          font={font}
          fontFamily={monoFont}
          fill={muted}
        />
      </svg>
      {onToggleSpeciesTree && (
        <Box
          onClick={onToggleSpeciesTree}
          sx={{
            mt: "auto",
            flex: `0 0 ${SPECIES_TOGGLE_H}px`,
            height: SPECIES_TOGGLE_H,
            minHeight: SPECIES_TOGGLE_H,
            position: fits ? "static" : "sticky",
            left: LEFT_COL_W,
            width: Math.min(gridW + RIGHT_PAD, Math.max(0, containerW - LEFT_COL_W)),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
            cursor: "pointer",
            color: "text.disabled",
          }}
        >
          {showSpeciesTree ? (
            <ExpandLessIcon sx={{ fontSize: 12, display: "block" }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 12, display: "block" }} />
          )}
        </Box>
      )}
    </Box>
  )
})

export default SpeciesHeader
