// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Box, Slider, Tooltip, Typography } from "@mui/material"

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
  step: number
  onChange: (value: number) => void
  onCommit?: () => void
}

export default function AxisSlider({
  icon,
  title,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: AxisSliderProps) {
  const [live, setLive] = useState(value)
  const dragging = useRef(false)
  useEffect(() => {
    if (!dragging.current) setLive(value)
  }, [value])
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Tooltip title={title} placement="top">
        <Box sx={{ display: "flex", color: "text.secondary" }}>{icon}</Box>
      </Tooltip>
      <Slider
        size="small"
        min={min}
        max={max}
        step={step}
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
