// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { QualityAssessmentPLDDTPreset } from "molstar/lib/extensions/model-archive/quality-assessment/behavior"
import { Structure } from "molstar/lib/mol-model/structure"
import { PluginContext } from "molstar/lib/mol-plugin/context"
import { predictedModelUrl } from "@/api/alphafold"
import { fetchCoordinates, type CoordinateSource } from "@/api/coordinates"
import { MODEL_BASE, RCSB_MODEL_BASE } from "../constants"
import type { ModelSource } from "./types"

function candidateSources(source: ModelSource): CoordinateSource[] {
  if (source.kind === "pdb")
    return [`${MODEL_BASE}/pdb/${source.pdbId}.bcif`, `${RCSB_MODEL_BASE}/${source.pdbId}.bcif`]
  const mirrored = source.file ? [`${MODEL_BASE}/${source.file}`] : []
  return [...mirrored, () => predictedModelUrl(source.accession, source.entryId)]
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

  const bytes = await fetchCoordinates(candidateSources(source))
  const data = await plugin.builders.data.rawData({ data: bytes, label: source.label })
  const trajectory = await plugin.builders.structure.parseTrajectory(data, "mmcif")
  const model = await plugin.builders.structure.createModel(trajectory)
  // Mol* names a structure by its model's label, which the file sets to its own entry id
  if (model.data) (model.data as { label: string }).label = source.label
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
