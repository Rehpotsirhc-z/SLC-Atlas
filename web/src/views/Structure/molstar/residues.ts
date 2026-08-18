// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { StructureElement, StructureProperties } from "molstar/lib/mol-model/structure"
import { PluginContext } from "molstar/lib/mol-plugin/context"
import type { Loci } from "molstar/lib/mol-model/loci"

// The same numbering lociForSpans selects on, so a residue read back here indexes the
// topology figure directly
function residueOf(loci: Loci): number | null {
  if (!StructureElement.Loci.is(loci)) return null
  const location = StructureElement.Loci.getFirstLocation(loci)
  return location ? StructureProperties.residue.label_seq_id(location) : null
}

// Report the residue under the pointer, so the figure can light the chain it belongs to.
export function subscribeHover(
  plugin: PluginContext,
  onHover: (residue: number | null) => void,
): () => void {
  const hover = plugin.behaviors.interaction.hover.subscribe((event) =>
    onHover(residueOf(event.current.loci)),
  )
  return () => hover.unsubscribe()
}
