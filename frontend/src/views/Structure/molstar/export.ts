// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { PluginContext } from "molstar/lib/mol-plugin/context"
import { pngScale } from "@/utils/exportFigure"

export async function downloadModelPng(plugin: PluginContext, filename: string): Promise<void> {
  const shot = plugin.helpers.viewportScreenshot
  if (!shot) return

  const gl = plugin.canvas3d?.webgl.gl
  const width = gl?.drawingBufferWidth ?? 0
  const height = gl?.drawingBufferHeight ?? 0

  if (width > 0 && height > 0) {
    const scale = pngScale(width, height)
    shot.behaviors.values.next({
      ...shot.values,
      resolution: {
        name: "custom",
        params: { width: Math.round(width * scale), height: Math.round(height * scale) },
      },
    })
  }

  await shot.download(filename)
}
