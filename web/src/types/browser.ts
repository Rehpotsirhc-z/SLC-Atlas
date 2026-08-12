// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Mirrors src/slc_atlas/models/browser.py using 0-based, half-open coordinates

export type ChromRole = "primary" | "alt" | "unplaced"

export interface Chrom {
  chrom: string
  ensembl: string
  size: number
  role: ChromRole
}

export interface CoverageTrack {
  track_id: string
  label: string
  group: string
  stranded: boolean
  local: boolean
  file: string | null
  plus_file: string | null
  minus_file: string | null
  url: string | null
  plus_url: string | null
  minus_url: string | null
  bin: number
  bytes: number
  chroms: string[]
}

export interface GwasStudy {
  study_id: string
  trait: string
  citation: string | null
  source: string | null
  assembly: string | null
  license_spdx: string | null
  n_variants: number
  // Distinguishes chromosomes without study data from those without significant hits
  chroms: string[]
}

export interface TrackManifest {
  chroms: Chrom[]
  tracks: CoverageTrack[]
  studies: GwasStudy[]
}

export interface Exon {
  start: number
  end: number
}

export interface TranscriptModel {
  transcript_id: string
  transcript_version: string | null
  model_gene_id: string | null
  gene_name: string | null
  biotype: string | null
  chrom: string
  start: number
  end: number
  strand: string
  cds_start: number | null
  cds_end: number | null
  exons: Exon[]
  is_atlas_gene: boolean
}

export interface Region {
  gene_id: string
  symbol: string | null
  chrom: string
  chrom_ensembl: string
  chrom_size: number | null
  gene_start: number
  gene_end: number
  strand: string | null
  window_start: number
  window_end: number
  // How far the view may travel from this gene, which is as much genome as the build kept
  pan_start: number
  pan_end: number
  flank: number
  clipped: boolean
}

/** One bigBed row: where it is, and one tab-separated string of everything else */
export interface RawFeature {
  start: number
  end: number
  rest: string
}

export interface GwasPoint {
  snp_id: string | null
  position: number
  p_value: number | null
  // Null marks a p-value that underflowed to zero
  neg_log10_p: number | null
  beta: number | null
}
