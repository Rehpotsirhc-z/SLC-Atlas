// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { createRoot, type Root } from "react-dom/client"
import { MAQualityAssessment } from "molstar/lib/extensions/model-archive/quality-assessment/behavior"
import { createPluginUI } from "molstar/lib/mol-plugin-ui"
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context"
import { DefaultPluginUISpec, type PluginUISpec } from "molstar/lib/mol-plugin-ui/spec"
import { PluginSpec } from "molstar/lib/mol-plugin/spec"
import { EMBEDDED_VIEWPORT } from "./layout"

import "./doom-one.scss"
import "./doom-one-light.scss"

const roots = new WeakMap<HTMLElement, Root>()

function renderInOwnedRoot(element: unknown, target: Element) {
  const container = target as HTMLElement
  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }
  root.render(element as Parameters<Root["render"]>[0])
}

export function disposeViewer(plugin: PluginUIContext, container: HTMLDivElement): void {
  plugin.dispose()
  const root = roots.get(container)
  roots.delete(container)
  if (root) queueMicrotask(() => root.unmount())
}

export async function createViewer(container: HTMLDivElement): Promise<PluginUIContext> {
  const base = DefaultPluginUISpec()
  const spec: PluginUISpec = {
    ...base,
    behaviors: [...base.behaviors, PluginSpec.Behavior(MAQualityAssessment)],
    layout: { initial: { isExpanded: false, showControls: false } },
    canvas3d: { camera: { helper: { axes: { name: "off", params: {} } } } },
    components: {
      ...base.components,
      remoteState: "none",
    },
    config: [...(base.config ?? []), ...EMBEDDED_VIEWPORT],
  }

  return createPluginUI({ target: container, render: renderInOwnedRoot, spec })
}
