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
  // Segments the annotation leaves so they don't touch
  pillGap: 2,
  // Cap on the rounded cap so a wide helix reads as a rounded rectangle, not an ellipse
  capRadius: 13,
  // A number shrinks with its pill down to minLabelSize, below which it is not worth drawing
  labelSize: 11,
  minLabelSize: 7,
  // Width of a digit as a fraction of its font size, for the figure's sans
  labelAspect: 0.58,
  // The halo that lifts a number off its pill, as a fraction of the font size
  labelHalo: 0.23,
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

export const SNAKE = {
  gutter: TRACK.gutter,
  padX: 16,
  padY: 14,
  bead: 7,
  spacing: 18,
  // How far off a bead the pointer still counts as on it
  hitRadius: 18,
  minSeparation: 15,
  coilRows: 7,
  // Below this a coil gives up spanning the band rather than narrowing to a ladder
  minCoilPerRow: 3,
  // How shallow a loop of one or two residues is allowed to bulge; floor it any higher and
  // the few beads it has poke out of the membrane instead of arcing over it
  minBow: 8,
  risePerResidue: 1.5,
  // A wrapped loop clears the membrane by this much before stacking its rows
  minRise: 26,
  // A loop too long for one run wraps into rows stacked away from the membrane; the caps
  // trade width against height, and these keep a whole family inside about 610 by 3900
  rowStep: 24,
  maxRows: 9,
  minRun: 36,
  maxRun: 230,
  // How far an internal loop's return leg runs clear of its own rows before dropping
  jog: 36,
  // Sagitta of a loop's runs, which is what keeps the chain outside from reading as a grid
  bow: 5,
  curveSamples: 8,
  letterSize: 8,
  segmentLabelSize: 11,
  segmentLabelGap: 7,
  chainWidth: 1.5,
  beadStroke: 1,
  siteRing: 2.5,
  litRing: 2.5,
} as const

// The band is exactly as tall as a full-length coil, so its rows need no stretching to span
export const SNAKE_BAND = SNAKE.spacing * (SNAKE.coilRows - 1)

// How far from the membrane the outermost row of the deepest loop can sit
export const SNAKE_MAX_DEPTH = SNAKE.minRise + (SNAKE.maxRows - 1) * SNAKE.rowStep

// How far the topology figure fades everything unrelated to the element under the pointer
export const DIM_OPACITY = 0.3

export const MODEL_BASE = "/api/structure/models"
// Where coordinates come from when this deployment mirrored none of its own
export const RCSB_MODEL_BASE = "https://models.rcsb.org"

// Tall enough that a 12-helix transporter is legible beside the topology figure; the viewer
// grows past it to whatever height the figure column takes
export const VIEWER_MIN_HEIGHT = 420

// Accession and family sit at this fraction of the gene name beside them
export const IDENTITY_SECONDARY_EM = "0.75em"

// max-content rather than 1fr, so a stat row that fits packs left instead of stretching
export const IDENTITY_GRID_COLUMNS = "repeat(auto-fit, minmax(120px, max-content))"

// The link row is pulled out by its button padding plus the launch glyph's own inset, so the
// icon starts on the stat text above it rather than the button box doing so
export const LINK_ROW_INK_INSET = 7
export const LINK_ROW_GAP = 12
export const LINK_ROW_WRAPPED_COLUMNS = "repeat(2, 1fr)"

export const RESOLUTION_DECIMALS = 2
export const EXPERIMENTAL_PAGE_SIZE = 10
export const SEARCH_WIDTH = 360

export const SIDE_BY_SIDE_MIN_WIDTH = 980
export const COLUMN_GAP = 16

export const MIN_CONTENT_WIDTH = TRACK.minWidth + 40
export const PREFERRED_CONTENT_WIDTH = 1100
export const CONTENT_PADDING_PX = 32
