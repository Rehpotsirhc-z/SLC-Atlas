// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { entryLabel } from "./experimentalEntry"
import type { ExperimentalStructure, StructureRecord } from "@/types/structure"
import type { ModelSource } from "./molstar/types"

export const PREDICTED_ID = "predicted"

const PREDICTED_LABEL = "Predicted model (AlphaFold)"

export interface ModelOption {
  id: string
  label: string
  source: ModelSource
}

export function buildModelOptions(
  structure: StructureRecord | null,
  experimental: ExperimentalStructure[] | undefined,
): ModelOption[] {
  const options: ModelOption[] = []

  if (structure?.uniprot_accession && structure.afdb_entry_id) {
    options.push({
      id: PREDICTED_ID,
      label: PREDICTED_LABEL,
      source: {
        kind: "afdb",
        file: structure.model_available ? structure.model_file : null,
        accession: structure.uniprot_accession,
        entryId: structure.afdb_entry_id,
        label: PREDICTED_LABEL,
      },
    })
  }

  for (const entry of experimental ?? []) {
    const label = entryLabel(entry)
    options.push({
      id: entry.pdb_id,
      label,
      source: { kind: "pdb", pdbId: entry.pdb_id, label },
    })
  }

  return options
}
