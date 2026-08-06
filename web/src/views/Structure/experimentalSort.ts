// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { methodLabel } from "./experimentalEntry"
import type { ExperimentalStructure } from "@/types/structure"
import type { SortDir } from "@/types/table"

export type ExperimentalSortKey =
  | "pdb_id"
  | "method"
  | "resolution"
  | "coverage"
  | "residues"
  | "ligands"

type SortValue = string | number | null

const SORT_VALUES: Record<ExperimentalSortKey, (entry: ExperimentalStructure) => SortValue[]> = {
  pdb_id: (e) => [e.pdb_id.toUpperCase()],
  method: (e) => [methodLabel(e.method)],
  resolution: (e) => [e.resolution],
  coverage: (e) => [e.coverage],
  residues: (e) => [e.uniprot_start, e.uniprot_end],
  ligands: (e) => [e.ligand_ccd],
}

function compare(a: SortValue, b: SortValue, sign: number) {
  // An entry the column says nothing about stays at the bottom either way round
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1
  if (typeof a === "number" && typeof b === "number") return sign * (a - b)
  return sign * String(a).localeCompare(String(b))
}

export function sortExperimental(
  entries: ExperimentalStructure[],
  key: ExperimentalSortKey,
  dir: SortDir,
) {
  const sign = dir === "asc" ? 1 : -1
  const values = SORT_VALUES[key]
  return [...entries].sort((a, b) => {
    const av = values(a)
    const bv = values(b)
    for (let i = 0; i < av.length; i++) {
      const cmp = compare(av[i], bv[i], sign)
      if (cmp !== 0) return cmp
    }
    return 0
  })
}
