// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useLayoutEffect, useRef, useState } from "react"

export type TbState = "full" | "counterCompact" | "compact" | "wrapped"

const TOOLBAR_PX = 32
const TOOLBAR_GAP = 12
const COUNTER_DIVIDER_W = 25

interface Options {
  counterText: string
  toggleCount: number
}

export function useToolbarFit({ counterText, toggleCount }: Options) {
  const [tbState, setTbState] = useState<TbState>("full")
  const toolbarRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLElement>(null)
  const textButtonsRef = useRef<HTMLDivElement>(null)
  const iconButtonsRef = useRef<HTMLDivElement>(null)
  const toggleEls = useRef<(HTMLDivElement | null)[]>([])
  const toggleSetters = useRef<((el: HTMLDivElement | null) => void)[]>([])

  const registerToggle = useCallback((index: number) => {
    toggleSetters.current[index] ??= (el) => {
      toggleEls.current[index] = el
    }
    return toggleSetters.current[index]
  }, [])

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    let threshFull = 0
    let threshCounterCompact = 0
    let threshCompact = 0

    function computeThresholds() {
      const counterW = counterRef.current?.offsetWidth ?? 0
      const textBtnsW = textButtonsRef.current?.offsetWidth ?? 0
      const iconBtnsW = iconButtonsRef.current?.offsetWidth ?? 0
      let togglesW = 0
      for (let i = 0; i < toggleCount; i++) togglesW += toggleEls.current[i]?.offsetWidth ?? 0
      const gaps = (toggleCount + 1) * TOOLBAR_GAP
      const counterChunk = counterW + COUNTER_DIVIDER_W
      threshFull = TOOLBAR_PX + togglesW + gaps + counterChunk + textBtnsW
      threshCounterCompact = TOOLBAR_PX + togglesW + gaps + counterChunk + iconBtnsW
      threshCompact = TOOLBAR_PX + togglesW + gaps + iconBtnsW
    }

    function check() {
      const el = toolbarRef.current
      if (!el) return
      const w = el.clientWidth
      if (w >= threshFull) setTbState("full")
      else if (w >= threshCounterCompact) setTbState("counterCompact")
      else if (w >= threshCompact) setTbState("compact")
      else setTbState("wrapped")
    }

    computeThresholds()
    check()
    document.fonts.ready.then(() => {
      computeThresholds()
      check()
    })

    const ro = new ResizeObserver(check)
    ro.observe(toolbar)
    return () => ro.disconnect()
  }, [counterText, toggleCount])

  return {
    tbState,
    toolbarRef,
    probeRefs: { counterRef, textButtonsRef, iconButtonsRef, registerToggle },
    showCounter: tbState === "full" || tbState === "counterCompact",
    iconButtons: tbState === "compact" || tbState === "counterCompact",
    wrapped: tbState === "wrapped",
  }
}

export type ToolbarProbeRefs = ReturnType<typeof useToolbarFit>["probeRefs"]
