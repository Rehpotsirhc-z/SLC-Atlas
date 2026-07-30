// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { PluginStateObject } from "molstar/lib/mol-plugin-state/objects"
import type { PluginContext } from "molstar/lib/mol-plugin/context"
import { StateAction } from "molstar/lib/mol-state"
import { ParamDefinition as PD } from "molstar/lib/mol-util/param-definition"
import { PREDICTED_ID, type ModelOption } from "../modelOptions"

interface ModelChoice {
  options: ModelOption[]
  selectedId: string
  onSelect: (id: string) => void
}

const choices = new WeakMap<object, ModelChoice>()

function choiceOf(globalCtx: unknown): ModelChoice | undefined {
  return choices.get(globalCtx as object)
}

export function setModelChoice(plugin: PluginContext, choice: ModelChoice): void {
  choices.set(plugin, choice)
}

export const ModelAction = StateAction.create<
  PluginStateObject.Root,
  Promise<void>,
  { model: string }
>({
  from: [PluginStateObject.Root],
  display: { name: "Model", description: "Which coordinates the viewer shows" },
  isApplicable: (_a, _t, globalCtx) => (choiceOf(globalCtx)?.options.length ?? 0) > 1,
  params: (_a, globalCtx) => {
    const choice = choiceOf(globalCtx)
    return {
      model: PD.Select(
        choice?.selectedId ?? PREDICTED_ID,
        (choice?.options ?? []).map((option) => [option.id, option.label] as [string, string]),
      ),
    }
  },
  run: async ({ params }, globalCtx) => {
    choiceOf(globalCtx)?.onSelect(params.model)
  },
})
