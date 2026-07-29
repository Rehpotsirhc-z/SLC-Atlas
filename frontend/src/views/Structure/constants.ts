// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Topology diagram geometry in SVG user units, lanes stacked top to bottom
export const TRACK = {
  // Left column holding the lane names, wide enough for "Non-cytoplasmic"
  gutter: 104,
  // Beyond this a lane name is cut off by the left edge of the figure
  maxLaneLabel: 16,
  padX: 14,
  padRight: 26,
  minWidth: 560,
  outsideLane: 56,
  membraneHeight: 62,
  insideLane: 56,
  laneGap: 10,
  confidenceLane: 20,
  axisGap: 12,
  axisLabels: 22,
  helixMinWidth: 12,
  // Cap on the rounded cap so a wide helix reads as a rounded rectangle, not an ellipse
  capRadius: 13,
  // Below this a pill has no room for its number
  minLabelWidth: 15,
  tickSpacing: 100,
  minArc: 9,
  // How far a loop bulges per residue, before clamping to its lane
  arcPerResidue: 0.5,
  // Where the chain meets a segment it leaves on the side it entered, as a fraction of the
  // pill width, so the two loops attach either side of the midline rather than at one point
  oneSidedJoin: 0.28,
  // One row per binding site
  siteRow: 13,
  siteBarMinWidth: 4,
  siteBarHeight: 8,
  chainWidth: 2,
  chainLitWidth: 3,
  chainHitWidth: 14,
  unresolvedDash: "5 4",
} as const

// How far the topology figure fades everything unrelated to the element under the pointer
export const DIM_OPACITY = 0.3

export const MODEL_BASE = "/api/structure/models"
// Where coordinates come from when this deployment mirrored none of its own
export const RCSB_MODEL_BASE = "https://models.rcsb.org"

// Tall enough that a 12-helix transporter is legible beside the topology figure
export const VIEWER_HEIGHT = 420

export const RESOLUTION_DECIMALS = 2
export const EXPERIMENTAL_PAGE_SIZE = 10
export const SEARCH_WIDTH = 360

// Narrower than this the topology figure would fall under TRACK.minWidth, so the 3D panel
// drops below it instead of squeezing both
export const SIDE_BY_SIDE_MIN_WIDTH = 980
export const COLUMN_GAP = 16

export const MIN_CONTENT_WIDTH = TRACK.minWidth + 40
// Width the detail pane wants before the rail is allowed to claim the leftover space, which
// is both columns at once so a wide window opens side by side rather than stacked
export const PREFERRED_CONTENT_WIDTH = 1100
export const CONTENT_PADDING_PX = 32
