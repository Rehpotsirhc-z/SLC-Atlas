// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// The bigBed field order must match `pipeline/lib/bigbed.py`

import type { Exon, RawFeature, TranscriptModel } from "@/types/browser"

const enum Model {
  Name,
  Score,
  Strand,
  ThickStart,
  ThickEnd,
  ItemRgb,
  BlockCount,
  BlockSizes,
  BlockStarts,
  GeneId,
  Version,
  Biotype,
  GeneName,
  IsAtlasGene,
}

const numbers = (packed: string): number[] =>
  packed
    .split(",")
    .filter((value) => value !== "")
    .map(Number)

function exons(start: number, sizes: string, starts: string): Exon[] {
  const widths = numbers(sizes)
  return numbers(starts).map((offset, at) => ({
    start: start + offset,
    end: start + offset + (widths[at] ?? 0),
  }))
}

const maybe = (value: string | undefined): string | null => (value ? value : null)

export function parseTranscript(chrom: string, feature: RawFeature): TranscriptModel {
  const fields = feature.rest.split("\t")
  const cdsStart = Number(fields[Model.ThickStart])
  const cdsEnd = Number(fields[Model.ThickEnd])
  // BED marks a transcript with no CDS by giving thick no width
  const coding = cdsStart !== cdsEnd
  return {
    transcript_id: fields[Model.Name] ?? "",
    transcript_version: maybe(fields[Model.Version]),
    model_gene_id: maybe(fields[Model.GeneId]),
    gene_name: maybe(fields[Model.GeneName]),
    biotype: maybe(fields[Model.Biotype]),
    chrom,
    start: feature.start,
    end: feature.end,
    strand: fields[Model.Strand] ?? "",
    cds_start: coding ? cdsStart : null,
    cds_end: coding ? cdsEnd : null,
    exons: exons(feature.start, fields[Model.BlockSizes] ?? "", fields[Model.BlockStarts] ?? ""),
    is_atlas_gene: fields[Model.IsAtlasGene] === "1",
  }
}
