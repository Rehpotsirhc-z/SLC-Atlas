// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import HeightIcon from "@mui/icons-material/Height"
import { Box, Button } from "@mui/material"
import AxisSlider from "@/components/heatmap/AxisSlider"
import { ROW_H_MAX, ROW_H_MIN, ROW_H_STEP } from "./phyloLayout"

interface Props {
  rowH: number
  onRowHChange: (value: number) => void
  onReset: () => void
}

export default function SpacingSettings({ rowH, onRowHChange, onReset }: Props) {
  return (
    <Box sx={{ pt: 1, pr: 1.5, pb: 0.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
      <AxisSlider
        icon={<HeightIcon sx={{ fontSize: 16 }} />}
        title="Row spacing"
        value={rowH}
        min={ROW_H_MIN}
        max={ROW_H_MAX}
        step={ROW_H_STEP}
        onChange={onRowHChange}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
        <Button
          size="small"
          onClick={onReset}
          aria-label="Reset row spacing to default"
          sx={{ py: 0, fontSize: 12, color: "text.secondary" }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  )
}
