// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { PluginCommands } from "molstar/lib/mol-plugin/commands"
import type { PluginContext } from "molstar/lib/mol-plugin/context"

const EDITABLE = "input, textarea, select, [contenteditable]"
const FLOATING_PANEL = ".msp-viewport-controls-panel"
const PANEL_CLOSE = ".msp-control-group-header button"

function closeFloatingPanel(root: HTMLElement): boolean {
  const panel = root.querySelector(FLOATING_PANEL)
  if (!panel) return false
  panel.querySelector<HTMLElement>(PANEL_CLOSE)?.click()
  return true
}

export function watchEscapeKey(plugin: PluginContext, root: HTMLElement): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return

    const active = document.activeElement
    if (active instanceof HTMLElement && root.contains(active) && active.closest(EDITABLE)) {
      active.blur()
      return
    }
    if (closeFloatingPanel(root)) return
    if (!plugin.layout.state.isExpanded) return
    // The browser owns Escape while it is showing the screen, so collapsing waits for the next one
    if (document.fullscreenElement) return

    PluginCommands.Layout.Update(plugin, {
      state: { isExpanded: false, expandToFullscreen: false },
    })
  }

  // Mol*'s own inputs blur themselves on Escape as the event bubbles, so a listener
  // waiting for it would find the field already left and close the panel in the same press
  window.addEventListener("keydown", onKeyDown, true)
  return () => window.removeEventListener("keydown", onKeyDown, true)
}
