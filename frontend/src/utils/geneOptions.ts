// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { GeneOption } from "@/components/autocomplete/GeneSearchPanel"

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

export function uniqueFamilies(rows: { family: string | null }[]): string[] {
  return [...new Set(rows.filter((r) => r.family).map((r) => r.family as string))].sort(byName)
}

export function uniqueGeneOptions(
  rows: { gene_id: string | null; symbol: string | null }[],
): GeneOption[] {
  const seen = new Map<string, string>()
  for (const r of rows)
    if (r.gene_id && r.symbol && !seen.has(r.gene_id)) seen.set(r.gene_id, r.symbol)
  return [...seen.entries()]
    .map(([id, symbol]) => ({ id, symbol }))
    .sort((a, b) => byName(a.symbol, b.symbol))
}
