// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Build readout data for selected coverage bins and gene models

import type { CoverageTrack, TranscriptModel } from "@/types/browser"
import { binAt, type Bin } from "./drawCoverage"
import type { GeneSpan } from "./geneLayout"
import type { LaneData } from "./useCoverageData"

export interface CellCoverage {
  trackId: string
  label: string
  color: string
  stranded: boolean
  plus: number | null
  minus: number | null
}

export interface CoverageAssay {
  group: string
  cells: CellCoverage[]
}

export interface TrackGroup {
  name: string
  members: CoverageTrack[]
}

function laneBin(lane: LaneData | undefined, base: number): Bin | null {
  if (!lane) return null
  return binAt(lane.plus, base) ?? (lane.minus ? binAt(lane.minus, base) : null)
}

export function binRangeAt(
  base: number,
  trackId: string | null,
  coverage: Map<string, LaneData>,
): Bin | null {
  const clicked = trackId ? laneBin(coverage.get(trackId), base) : null
  if (clicked) return clicked
  for (const lane of coverage.values()) {
    const bin = laneBin(lane, base)
    if (bin) return bin
  }
  return null
}

// Read coverage at one base and group the results by assay
export function binReadout(
  base: number,
  groups: TrackGroup[],
  coverage: Map<string, LaneData>,
  colors: Map<string, string>,
  fallbackColor: string,
): CoverageAssay[] {
  return groups.map((group) => ({
    group: group.name,
    cells: group.members.map((track) => {
      const lane = coverage.get(track.track_id)
      const plus = lane ? binAt(lane.plus, base) : null
      const minus = lane?.minus ? binAt(lane.minus, base) : null
      return {
        trackId: track.track_id,
        label: track.label,
        color: colors.get(track.label) ?? fallbackColor,
        stranded: track.stranded,
        plus: plus?.value ?? null,
        minus: minus?.value ?? null,
      }
    }),
  }))
}

export interface GenePick {
  geneId: string
  label: string
  biotype: string | null
  strand: string
  start: number
  end: number
  structure: string
}

export function genePickFrom(item: TranscriptModel | GeneSpan): GenePick {
  if ("transcript_id" in item) {
    return {
      geneId: item.model_gene_id ?? item.transcript_id,
      label: item.gene_name || item.model_gene_id || item.transcript_id,
      biotype: item.biotype,
      strand: item.strand,
      start: item.start,
      end: item.end,
      structure: `${item.exons.length} exons`,
    }
  }
  return {
    geneId: item.gene_id,
    label: item.label,
    biotype: item.biotype,
    strand: item.strand,
    start: item.start,
    end: item.end,
    structure: `${item.transcripts} transcripts`,
  }
}
