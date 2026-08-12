// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { doomColors, type ThemeMode } from "@/theme"

// Keep familiar biotypes visually consistent across datasets
const BIOTYPE_HUES = {
  protein_coding: "blue",
  protein_coding_CDS_not_defined: "blue",
  protein_coding_LoF: "blue",
  nonsense_mediated_decay: "red",
  non_stop_decay: "red",
  lncRNA: "teal",
  retained_intron: "magenta",
  processed_transcript: "green",
  processed_pseudogene: "yellow",
  unprocessed_pseudogene: "yellow",
  transcribed_unprocessed_pseudogene: "yellow",
  transcribed_processed_pseudogene: "yellow",
  miRNA: "orange",
  snoRNA: "orange",
  snRNA: "orange",
  misc_RNA: "orange",
  rRNA_pseudogene: "orange",
} as const satisfies Record<string, keyof (typeof doomColors)["dark"]>

const FALLBACK_HUE = "base6"

export function biotypeColor(biotype: string | null | undefined, mode: ThemeMode): string {
  const hue = (biotype && BIOTYPE_HUES[biotype as keyof typeof BIOTYPE_HUES]) || FALLBACK_HUE
  return doomColors[mode][hue]
}

// Limit the legend to the most useful GENCODE groups
export const BIOTYPE_LEGEND = [
  { biotype: "protein_coding", label: "protein coding" },
  { biotype: "nonsense_mediated_decay", label: "NMD" },
  { biotype: "lncRNA", label: "lncRNA" },
  { biotype: "retained_intron", label: "retained intron" },
  { biotype: "processed_pseudogene", label: "pseudogene" },
  { biotype: "miRNA", label: "small RNA" },
  { biotype: "", label: "other" },
] as const
