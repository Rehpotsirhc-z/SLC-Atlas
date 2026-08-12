// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Turning the rows of a bigBed into the shapes the Genome Browser draws.
 *
 * A bigBed row is its span and one tab-separated string of everything else, in the order
 * `pipeline/lib/bigbed.py` wrote it. The two sides are only ever changed together, so the
 * field order is named here rather than counted out at each use.
 */

import type { Exon, GwasPoint, RawFeature, TranscriptModel } from "@/types/browser"

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

const enum Variant {
  SnpId,
  PValue,
  NegLog10P,
  Beta,
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

const number = (value: string | undefined): number | null =>
  value === undefined || value === "" ? null : Number(value)

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

export function parseVariant(feature: RawFeature): GwasPoint {
  const fields = feature.rest.split("\t")
  const snp = fields[Variant.SnpId]
  return {
    snp_id: snp && snp !== "." ? snp : null,
    position: feature.start,
    p_value: number(fields[Variant.PValue]),
    // Empty marks a p-value that underflowed to zero, which is drawn above the scale
    neg_log10_p: number(fields[Variant.NegLog10P]),
    beta: number(fields[Variant.Beta]),
  }
}
