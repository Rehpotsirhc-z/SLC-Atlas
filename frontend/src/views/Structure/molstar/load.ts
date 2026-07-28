// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { QualityAssessmentPLDDTPreset } from "molstar/lib/extensions/model-archive/quality-assessment/behavior"
import { Structure } from "molstar/lib/mol-model/structure"
import { PluginContext } from "molstar/lib/mol-plugin/context"
import { fetchCoordinates } from "@/api/coordinates"
import { MODEL_BASE, RCSB_MODEL_BASE } from "../constants"
import type { ModelSource } from "./types"

function candidateUrls(source: ModelSource): string[] {
  if (source.kind === "afdb") return [`${MODEL_BASE}/${source.file}`]
  return [`${MODEL_BASE}/pdb/${source.pdbId}.bcif`, `${RCSB_MODEL_BASE}/${source.pdbId}.bcif`]
}

const PRESET_DEFAULTS = {
  ignoreHydrogens: undefined,
  ignoreHydrogensVariant: undefined,
  ignoreLight: undefined,
  quality: undefined,
  theme: undefined,
}

export async function loadModel(plugin: PluginContext, source: ModelSource): Promise<void> {
  await plugin.clear()

  const bytes = await fetchCoordinates(candidateUrls(source))
  const data = await plugin.builders.data.rawData({ data: bytes })
  const trajectory = await plugin.builders.structure.parseTrajectory(data, "mmcif")
  const model = await plugin.builders.structure.createModel(trajectory)
  const structure = await plugin.builders.structure.createStructure(model)

  if (source.kind === "afdb") {
    await QualityAssessmentPLDDTPreset.apply(structure.ref, PRESET_DEFAULTS, plugin)
  } else {
    await plugin.builders.structure.representation.applyPreset(structure.ref, "auto")
  }
  if (structure.data) {
    plugin.managers.camera.focusLoci(Structure.Loci(structure.data), {
      extraRadius: 0,
      durationMs: 0,
    })
  }
}
