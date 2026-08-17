// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback, useImperativeHandle, useRef } from "react"
import { Box, useTheme } from "@mui/material"
import { AXIS_FONT_PX, AXIS_TICK_PX, AXIS_W, Y_TICK_MAX } from "./constants"
import { formatSignal, yTicks } from "./yAxis"

const SLOTS = Y_TICK_MAX * 2 + 1

export interface AxisHandle {
  draw: (max: number, stranded: boolean, reach?: number) => void
}

interface Props {
  height: number
  handleRef: React.RefObject<AxisHandle | null>
}

interface Slot {
  tick: HTMLElement | null
  label: HTMLElement | null
}

function LaneAxis({ height, handleRef }: Props) {
  const { palette, custom } = useTheme()
  const slots = useRef<Slot[]>([])
  const shown = useRef("")

  const setSlot = useCallback((index: number, part: keyof Slot, el: HTMLElement | null) => {
    const held = (slots.current[index] ??= { tick: null, label: null })
    held[part] = el
  }, [])

  const draw = useCallback(
    (max: number, stranded: boolean, span?: number) => {
      const key = `${max}|${stranded}|${height}|${span ?? ""}`
      if (shown.current === key) return
      shown.current = key

      const baseline = stranded ? height / 2 : height
      const reach = span ?? (stranded ? height / 2 : height)
      const marks: { y: number; text: string }[] = [{ y: baseline, text: "0" }]
      for (const value of yTicks(max, reach)) {
        const offset = (value / max) * reach
        marks.push({
          y: baseline - offset,
          text: stranded ? `+${formatSignal(value)}` : formatSignal(value),
        })
        if (stranded) marks.push({ y: baseline + offset, text: `−${formatSignal(value)}` })
      }

      slots.current.forEach((slot, index) => {
        const mark = marks[index]
        if (!mark) {
          if (slot.tick) slot.tick.style.display = "none"
          if (slot.label) slot.label.style.display = "none"
          return
        }
        if (slot.tick) {
          slot.tick.style.display = "block"
          slot.tick.style.top = `${mark.y}px`
        }
        if (slot.label) {
          slot.label.style.display = "block"
          const clamped = Math.min(Math.max(mark.y, AXIS_FONT_PX / 2), height - AXIS_FONT_PX / 2)
          slot.label.style.top = `${clamped}px`
          slot.label.textContent = mark.text
        }
      })
    },
    [height],
  )

  useImperativeHandle(handleRef, () => ({ draw }), [draw])

  return (
    <Box
      sx={{
        width: AXIS_W,
        flexShrink: 0,
        position: "relative",
        height,
        borderRight: 1,
        borderColor: "text.disabled",
      }}
    >
      {[...Array(SLOTS).keys()].map((index) => (
        <Box key={index} component="span">
          <Box
            component="span"
            ref={(el: HTMLElement | null) => setSlot(index, "label", el)}
            sx={{
              position: "absolute",
              left: 0,
              right: `${AXIS_TICK_PX + 3}px`,
              display: "none",
              textAlign: "right",
              transform: "translateY(-50%)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontSize: AXIS_FONT_PX,
              lineHeight: 1,
              fontFamily: custom.monoFontFamily,
              color: "text.secondary",
              pointerEvents: "none",
            }}
          />
          <Box
            component="span"
            ref={(el: HTMLElement | null) => setSlot(index, "tick", el)}
            sx={{
              position: "absolute",
              right: 0,
              width: `${AXIS_TICK_PX}px`,
              display: "none",
              borderTop: `1px solid ${palette.text.disabled}`,
              pointerEvents: "none",
            }}
          />
        </Box>
      ))}
    </Box>
  )
}

export default memo(LaneAxis)
