// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface DataDomain {
  key: string
  label: string
  method: string
  capability?: string
}

// Keep processing summaries separate from provenance supplied by source records
export const DATA_DOMAINS: DataDomain[] = [
  {
    key: "genes",
    label: "Genes",
    method:
      "Gene symbols are matched to stable Ensembl IDs and organized into families. Each gene includes its transcripts and a short description of its function.",
  },
  {
    key: "expression",
    label: "Expression",
    method:
      "Expression for each gene is averaged across samples from the same tissue. In the brain view, samples are grouped into smaller brain regions.",
    capability: "expression",
  },
  {
    key: "conservation",
    label: "Conservation",
    method:
      "Each gene is compared with its orthologs in other species using protein sequence identity, then shown alongside the species tree. The human gene is the 100% reference.",
    capability: "conservation",
  },
  {
    key: "clustering",
    label: "Clustering",
    method:
      "Genes are grouped by similarity in protein sequence, expression pattern, or conservation across species. Protein and coding sequences are aligned before sequence-based clustering.",
    capability: "clustering",
  },
  {
    key: "structure",
    label: "Structure",
    method:
      "Each gene is linked to its canonical protein and any available predicted or experimental structures. The view combines model confidence, topology, binding sites, and residue-level cross-references.",
    capability: "structure",
  },
  {
    key: "browser",
    label: "Genome Browser",
    method:
      "The browser shows transcripts, coverage tracks, and GWAS signals around each gene. It loads only the part of each dataset needed for the current region.",
    capability: "browser",
  },
]
