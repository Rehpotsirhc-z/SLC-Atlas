// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ChainModel } from "./chainModel"
import { confidenceBars, type ConfidenceBar } from "./confidenceBars"
import { SEQUENCE, TRACK } from "./constants"
import type { LaneLabel } from "./membraneSides"
import { residueAxis, type AxisTick } from "./residueAxis"
import type { FeatureMark, SignalPeptide } from "./sequenceFeatures"
import { placeSites, type PlacedSite } from "./siteLane"

export interface RailMark extends FeatureMark {
  x: number
  y: number
  row: number
}

export interface SignalBlock extends SignalPeptide {
  x: number
  width: number
}

export interface FeaturesLayout {
  width: number
  height: number
  length: number
  plotLeft: number
  plotRight: number
  railTop: number
  railBottom: number
  bindsTop: number
  bindsHeight: number
  confidenceTop: number
  confidenceHeight: number
  axisY: number
  axisLabelY: number
  lanes: LaneLabel[]
  marks: RailMark[]
  signal: SignalBlock | null
  sites: PlacedSite[]
  confidence: ConfidenceBar[]
  ticks: AxisTick[]
  termini: { label: "N" | "C"; x: number }[]
}

export const EMPTY_FEATURES: FeaturesLayout = {
  width: 0,
  height: 0,
  length: 0,
  plotLeft: 0,
  plotRight: 0,
  railTop: 0,
  railBottom: 0,
  bindsTop: 0,
  bindsHeight: 0,
  confidenceTop: 0,
  confidenceHeight: 0,
  axisY: 0,
  axisLabelY: 0,
  lanes: [],
  marks: [],
  signal: null,
  sites: [],
  confidence: [],
  ticks: [],
  termini: [],
}

function stackMarks(marks: FeatureMark[], toX: (residue: number) => number) {
  const taken: number[] = []
  return marks.map((mark) => {
    const x = toX(mark.start)
    let row = taken.findIndex((last) => x - last >= SEQUENCE.markMinGap)
    if (row === -1) row = taken.length
    taken[row] = x
    return { ...mark, x, row }
  })
}

function markLaneHeight(rows: number): number {
  if (!rows) return SEQUENCE.emptyLane
  return SEQUENCE.stem + (rows - 1) * SEQUENCE.rowStep + SEQUENCE.markRadius + SEQUENCE.markPad
}

export function layoutFeatures(
  model: ChainModel,
  width: number,
  plddt: number[] | null,
): FeaturesLayout {
  const { length, sites, marks, signal } = model
  const axis = residueAxis(length, width)
  const { plotLeft, plotRight, toX, boxFor, ticks } = axis

  const stacked = stackMarks(marks, toX)
  const rows = stacked.reduce((most, mark) => Math.max(most, mark.row + 1), 0)
  const railTop = markLaneHeight(rows)
  const railBottom = railTop + SEQUENCE.railHeight

  const bindsTop = railBottom + (sites.length ? TRACK.laneGap : 0)
  const bindsHeight = sites.length * TRACK.siteRow
  const confidence = confidenceBars(plddt, length)
  const confidenceTop = bindsTop + bindsHeight + (confidence.length ? TRACK.laneGap : 0)
  const confidenceHeight = confidence.length ? TRACK.confidenceLane : 0
  const axisY = confidenceTop + confidenceHeight + TRACK.axisGap

  const lanes: LaneLabel[] = [{ key: "chain", label: "Chain", y: (railTop + railBottom) / 2 }]
  if (sites.length) lanes.push({ key: "binds", label: "Binds", y: bindsTop + bindsHeight / 2 })
  if (confidence.length) {
    lanes.push({ key: "confidence", label: "Confidence", y: confidenceTop + confidenceHeight / 2 })
  }

  return {
    width: plotRight + TRACK.padRight,
    height: axisY + TRACK.axisLabels,
    length,
    plotLeft,
    plotRight,
    railTop,
    railBottom,
    bindsTop,
    bindsHeight,
    confidenceTop,
    confidenceHeight,
    axisY,
    axisLabelY: axisY + 14,
    lanes,
    marks: stacked.map((mark) => ({
      ...mark,
      y: railTop - SEQUENCE.stem - mark.row * SEQUENCE.rowStep,
    })),
    signal: signal && { ...signal, ...boxFor(signal.start, signal.end, SEQUENCE.signalMinWidth) },
    sites: placeSites(sites, model.ligands, axis, bindsTop),
    confidence,
    ticks,
    termini: [
      { label: "N", x: plotLeft },
      { label: "C", x: plotRight },
    ],
  }
}
