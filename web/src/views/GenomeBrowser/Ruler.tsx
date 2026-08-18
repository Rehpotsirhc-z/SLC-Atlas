// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useMemo } from "react"
import { Box, useTheme } from "@mui/material"
import {
  CANVAS_FONT_PX,
  EDGE_PAD,
  RULER_H,
  RULER_LABEL_GAP_PX,
  RULER_TICK_GAP_PX,
} from "./constants"
import { rulerTicks, type Scale, type Viewport } from "./scale"
import { useLaneCanvas } from "./useLaneCanvas"
import type { Painter } from "./useBrowserView"

interface Props {
  width: number
  gutter: number
  subscribe: (paint: Painter) => () => void
  liveView: () => Viewport
}

function Ruler({ width, gutter, subscribe, liveView }: Props) {
  const { palette, custom } = useTheme()

  const ink = useMemo(
    () => ({
      line: palette.text.disabled,
      text: palette.text.secondary,
      font: `${CANVAS_FONT_PX}px ${custom.monoFontFamily}`,
    }),
    [palette, custom],
  )

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, scale: Scale) => {
      ctx.clearRect(0, 0, scale.width, RULER_H)
      ctx.strokeStyle = ink.line
      ctx.fillStyle = ink.text
      ctx.font = ink.font
      ctx.textBaseline = "alphabetic"
      ctx.textAlign = "center"
      ctx.lineWidth = 1

      const baseline = RULER_H - 0.5
      ctx.beginPath()
      ctx.moveTo(0, baseline)
      ctx.lineTo(scale.width, baseline)
      ctx.stroke()

      const ticks = rulerTicks(
        scale,
        RULER_TICK_GAP_PX,
        RULER_LABEL_GAP_PX,
        (label) => ctx.measureText(label).width,
      )
      for (const tick of ticks) {
        const x = Math.round(tick.x) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, RULER_H - 7)
        ctx.lineTo(x, RULER_H)
        ctx.stroke()
        if (tick.showLabel) ctx.fillText(tick.label, tick.labelX, RULER_H - 12)
      }
    },
    [ink],
  )

  const canvasRef = useLaneCanvas(subscribe, liveView, width, RULER_H, paint)

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", pr: `${EDGE_PAD}px` }}>
      <Box sx={{ width: gutter, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0, height: RULER_H }}>
        <canvas ref={canvasRef} style={{ display: "block", width, height: RULER_H }} />
      </Box>
    </Box>
  )
}

export default memo(Ruler)
