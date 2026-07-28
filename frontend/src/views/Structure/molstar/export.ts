// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { PluginContext } from "molstar/lib/mol-plugin/context"

export async function downloadModelPng(plugin: PluginContext, filename: string): Promise<void> {
  await plugin.helpers.viewportScreenshot?.download(filename)
}
