// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { PluginUISpec } from "molstar/lib/mol-plugin-ui/spec"
import { PluginCommands } from "molstar/lib/mol-plugin/commands"
import { PluginConfig, type PluginConfigItem } from "molstar/lib/mol-plugin/config"
import type { PluginContext } from "molstar/lib/mol-plugin/context"

type ViewportConfig = NonNullable<PluginUISpec["config"]>

export const EMBEDDED_VIEWPORT: ViewportConfig = [
  [PluginConfig.Viewport.ShowAnimation, false],
  [PluginConfig.Viewport.ShowTrajectoryControls, false],
  [PluginConfig.Viewport.ShowIllumination, false],
  [PluginConfig.Viewport.ShowXR, "never"],
  [PluginConfig.Viewport.ShowControls, false],
]

const EXPANDED_VIEWPORT: ViewportConfig = [
  [PluginConfig.Viewport.ShowAnimation, true],
  [PluginConfig.Viewport.ShowTrajectoryControls, true],
  [PluginConfig.Viewport.ShowIllumination, true],
  [PluginConfig.Viewport.ShowXR, "never"],
  [PluginConfig.Viewport.ShowControls, true],
]

function applyMode(plugin: PluginContext, expanded: boolean) {
  for (const [key, value] of expanded ? EXPANDED_VIEWPORT : EMBEDDED_VIEWPORT) {
    plugin.config.set(key as PluginConfigItem<unknown>, value)
  }
  PluginCommands.Layout.Update(plugin, {
    state: {
      showControls: expanded,
      regionState: { left: "full", top: "full", right: "full", bottom: "full" },
    },
  })
}

export function watchLayoutMode(plugin: PluginContext): () => void {
  let applied = plugin.layout.state.isExpanded
  let expandedForFullscreen = false

  const subscription = plugin.layout.events.updated.subscribe(() => {
    const { isExpanded } = plugin.layout.state
    if (isExpanded === applied) return
    applied = isExpanded
    queueMicrotask(() => applyMode(plugin, isExpanded))
  })

  // Expanding before fullscreen engages makes Mol* re-request it and the browser refuse
  const onFullscreen = () => {
    const { isExpanded, expandToFullscreen } = plugin.layout.state
    if (document.fullscreenElement) {
      if (isExpanded || !expandToFullscreen) return
      expandedForFullscreen = true
      PluginCommands.Layout.Update(plugin, { state: { isExpanded: true } })
    } else if (expandedForFullscreen) {
      expandedForFullscreen = false
      PluginCommands.Layout.Update(plugin, { state: { isExpanded: false } })
    }
  }
  document.addEventListener("fullscreenchange", onFullscreen)

  return () => {
    document.removeEventListener("fullscreenchange", onFullscreen)
    subscription.unsubscribe()
  }
}
