// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { Gene } from "@/types/gene"
import { downloadName, triggerDownload } from "@/utils/download"

const COLUMNS: (keyof Gene)[] = [
  "id",
  "symbol",
  "name",
  "chromosome",
  "start",
  "end",
  "strand",
  "length",
  "alias",
  "category",
  "family",
  "family_name",
  "function_brief",
]

function genesToTsvBlob(genes: Gene[]): Blob {
  const header = COLUMNS.join("\t")
  const rows = genes.map((g) => COLUMNS.map((col) => g[col] ?? "").join("\t"))
  return new Blob([[header, ...rows].join("\n")], { type: "text/tab-separated-values" })
}

function genesToJsonBlob(genes: Gene[]): Blob {
  return new Blob([JSON.stringify(genes, null, 2)], { type: "application/json" })
}

export function downloadGenes(genes: Gene[], format: "tsv" | "json"): void {
  const blob = format === "tsv" ? genesToTsvBlob(genes) : genesToJsonBlob(genes)
  triggerDownload(blob, downloadName(`genes.${format}`))
}
