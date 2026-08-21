// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState, type ReactNode } from "react"
import HeightIcon from "@mui/icons-material/Height"
import { Box, Button, Slider, Tooltip, Typography } from "@mui/material"
import { CELL_H_MAX, CELL_H_MIN, CELL_SIZE_STEP, CELL_W_MAX, CELL_W_MIN } from "./constants"

interface CellSizeSlidersProps {
  width: number
  height: number
  onWidthChange: (value: number) => void
  onWidthChangeCommitted: () => void
  onHeightChange: (value: number) => void
  onReset: () => void
}

const valueSx = {
  fontSize: 11,
  color: "text.secondary",
  width: 30,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
} as const

interface AxisSliderProps {
  icon: ReactNode
  title: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onCommit?: () => void
}

function AxisSlider({ icon, title, value, min, max, onChange, onCommit }: AxisSliderProps) {
  const [live, setLive] = useState(value)
  const dragging = useRef(false)
  useEffect(() => {
    if (!dragging.current) setLive(value)
  }, [value])
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Tooltip title={title} placement="top" arrow>
        <Box sx={{ display: "flex", color: "text.secondary" }}>{icon}</Box>
      </Tooltip>
      <Slider
        size="small"
        min={min}
        max={max}
        step={CELL_SIZE_STEP}
        value={live}
        onChange={(_event, next) => {
          dragging.current = true
          setLive(next as number)
          onChange(next as number)
        }}
        onChangeCommitted={(_event, next) => {
          dragging.current = false
          setLive(next as number)
          onCommit?.()
        }}
        aria-label={title}
        sx={{ py: 0.5 }}
      />
      <Typography component="span" sx={valueSx}>
        {live}px
      </Typography>
    </Box>
  )
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
        onChange={onWidthChange}
        onCommit={onWidthChangeCommitted}
      />
      <AxisSlider
        icon={<HeightIcon sx={{ fontSize: 16 }} />}
        title="Row height"
        value={height}
        min={CELL_H_MIN}
        max={CELL_H_MAX}
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
