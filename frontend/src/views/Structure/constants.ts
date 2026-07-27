// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export const TRACK = {
  height: 172,
  padX: 30,
  minWidth: 520,
  outsideY: 30,
  membraneTop: 46,
  membraneHeight: 54,
  insideY: 116,
  ligandY: 132,
  axisY: 156,
  loopThickness: 3,
  minLabelWidth: 13,
  tickSpacing: 100,
} as const

export const RESOLUTION_DECIMALS = 2
export const EXPERIMENTAL_PAGE_SIZE = 10
export const SEARCH_WIDTH = 360

export const MIN_CONTENT_WIDTH = TRACK.minWidth + 40
export const PREFERRED_CONTENT_WIDTH = 900
export const CONTENT_PADDING_PX = 32
