// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { StructureSelection } from "molstar/lib/mol-model/structure"
import { PluginContext } from "molstar/lib/mol-plugin/context"
import { Script } from "molstar/lib/mol-script/script"
import type { ResidueSpan } from "./types"

function currentStructure(plugin: PluginContext) {
  return plugin.managers.structure.hierarchy.current.structures[0]?.cell.obj?.data
}

// AlphaFold numbers its residues in UniProt, which is what the topology figure counts in,
// so a span crosses over without translation
function lociForSpans(plugin: PluginContext, spans: ResidueSpan[]) {
  const structure = currentStructure(plugin)
  if (!structure || spans.length === 0) return null

  const selection = Script.getStructureSelection(
    (Q) =>
      Q.struct.generator.atomGroups({
        "residue-test": Q.core.logic.or(
          spans.map((span) =>
            Q.core.rel.inRange([
              Q.struct.atomProperty.macromolecular.label_seq_id(),
              span.start,
              span.end,
            ]),
          ),
        ),
      }),
    structure,
  )
  const loci = StructureSelection.toLociWithSourceUnits(selection)
  return StructureSelection.isEmpty(selection) ? null : loci
}

export function applyHighlight(plugin: PluginContext, spans: ResidueSpan[]): void {
  const loci = lociForSpans(plugin, spans)
  if (loci) plugin.managers.interactivity.lociHighlights.highlightOnly({ loci })
  else plugin.managers.interactivity.lociHighlights.clearHighlights()
}

const FOCUS_CONTEXT_RADIUS = 12

export function focusCamera(plugin: PluginContext, spans: ResidueSpan[]): void {
  const loci = lociForSpans(plugin, spans)
  if (loci) plugin.managers.camera.focusLoci(loci, { extraRadius: FOCUS_CONTEXT_RADIUS })
}
