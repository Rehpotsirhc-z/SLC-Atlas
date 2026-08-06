// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export type ModelSource =
  | { kind: "afdb"; file: string | null; accession: string; entryId: string; label: string }
  | { kind: "pdb"; pdbId: string; label: string }

export interface ResidueSpan {
  start: number
  end: number
}

export type ModelExporter = (filename: string) => Promise<void>
