// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import HeightIcon from "@mui/icons-material/Height"
import { Box, Button } from "@mui/material"
import AxisSlider from "./AxisSlider"
import { CELL_H_MAX, CELL_H_MIN, CELL_SIZE_STEP, CELL_W_MAX, CELL_W_MIN } from "./constants"

interface CellSizeSlidersProps {
  width: number
  height: number
  onWidthChange: (value: number) => void
  onWidthChangeCommitted: () => void
  onHeightChange: (value: number) => void
  onReset: () => void
}

export default function CellSizeSliders({
  width,
  height,
  onWidthChange,
  onWidthChangeCommitted,
  onHeightChange,
  onReset,
}: CellSizeSlidersProps) {
  return (
    <Box sx={{ pr: 1.5, pb: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
      <AxisSlider
        icon={<HeightIcon sx={{ fontSize: 16, transform: "rotate(90deg)" }} />}
        title="Column width"
        value={width}
        min={CELL_W_MIN}
        max={CELL_W_MAX}
        step={CELL_SIZE_STEP}
        onChange={onWidthChange}
        onCommit={onWidthChangeCommitted}
      />
      <AxisSlider
        icon={<HeightIcon sx={{ fontSize: 16 }} />}
        title="Row height"
        value={height}
        min={CELL_H_MIN}
        max={CELL_H_MAX}
        step={CELL_SIZE_STEP}
        onChange={onHeightChange}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
        <Button
          size="small"
          onClick={onReset}
          aria-label="Reset cell size to auto"
          sx={{ py: 0, fontSize: 12, color: "text.secondary" }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  )
}
