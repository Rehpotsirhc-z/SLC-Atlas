// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { PluginCommands } from "molstar/lib/mol-plugin/commands"
import { PluginContext } from "molstar/lib/mol-plugin/context"
import { Color } from "molstar/lib/mol-util/color"

const toColor = (hex: string) => Color(Number.parseInt(hex.slice(1), 16))

// Repaints in place; remounting the plugin on a theme toggle would refetch the coordinates
export function syncBackground(plugin: PluginContext, hex: string): void {
  PluginCommands.Canvas3D.SetSettings(plugin, {
    settings: (props) => {
      props.renderer.backgroundColor = toColor(hex)
    },
  })
}

export function syncMarkers(plugin: PluginContext, highlight: string, select: string): void {
  PluginCommands.Canvas3D.SetSettings(plugin, {
    settings: (props) => {
      props.marking.highlightEdgeColor = toColor(highlight)
      props.marking.selectEdgeColor = toColor(select)
      props.renderer.highlightColor = toColor(highlight)
      props.renderer.selectColor = toColor(select)
    },
  })
}
