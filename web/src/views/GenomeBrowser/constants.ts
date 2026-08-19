// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export const EDGE_PAD = 16

export const GUTTER_W = 168
export const GUTTER_W_SM = 118

export const AXIS_W = 54
export const AXIS_FONT_PX = 10
export const AXIS_TICK_PX = 4
// Minimum spacing between automatic and pinned axis labels
export const AXIS_LABEL_GAP_PX = AXIS_FONT_PX + 3

export const Y_TICK_GAP_PX = 26
export const Y_TICK_MAX = 4

export const MINUS_ALPHA = 0.6

export const RULER_H = 38
export const LANE_GAP = 7
export const GROUP_GAP = 8

// Ticks sit at least this far apart, enough that two centered coordinate labels never touch
export const RULER_TICK_GAP_PX = 92
// An edge label pulled inside the plot is dropped rather than drawn closer than this to its neighbor
export const RULER_LABEL_GAP_PX = 6

// Region shown around a point locus such as chr9:4500000
export const ARRIVAL_POINT_SPAN = 100_000

export const GWAS_LANE_HEIGHT = 112
export const GWAS_LANE_KEY = "gwas"
export const GWAS_POINT_R = 2.5
// The conventional genome-wide significance threshold
export const GWAS_SIGNIFICANCE_P = 5e-8

export const GENE_ROW_H = 19
// Leave enough room between models to display their labels
export const MODEL_GAP_PX = 48
export const GENE_TRACK_PAD = 8
export const GENE_TRACK_MIN_H = 74
export const GENE_TRACK_MAX_H = 264
// Limit how much of the plot the pinned gene track can occupy
export const GENE_TRACK_MAX_SHARE = 0.45
export const MAX_GENE_ROWS = 40
// Room a label needs before it is worth drawing at all
export const LABEL_MIN_PX = 38
export const LABEL_GAP_PX = 6

export const EXON_H = 13
export const UTR_H = 7
export const ARROW_H = 9
// Minimum legible arrowhead height
export const ARROW_MIN_H = 5
// Bases per chevron along an intron, in pixels
export const CHEVRON_SPACING = 46

// A feature narrower than this would vanish, so it is drawn at this width instead
export const MIN_FEATURE_PX = 1.5

export const Y_HEADROOM = 1.08

// Past this the whole exon structure of a transcript is a pixel or two of chain, and a
// chromosome holds tens of thousands of them, so the track draws one row per gene instead
export const TRANSCRIPT_MAX_SPAN = 4_000_000

export const ZOOM_STEP = 2
// Zooming further than this shows individual bases, which no track here resolves
export const MIN_VIEW_BP = 50

// A wheel asks for this much zoom per pixel of delta, as an exponent, so a trackpad pinch
// reads as one continuous movement rather than as a series of doublings. A notch of a mouse
// wheel is a hundred or so of these, which lands near a third wider or narrower
export const WHEEL_ZOOM_PER_PX = 1 / 250
// A single event may not travel further than this, since a wheel that reports in lines or in
// pages arrives in numbers of a different order
export const WHEEL_ZOOM_MAX = 4

// Publish burst-based gestures shortly after their last event so data loading starts promptly
export const VIEW_SETTLE_MS = 140

// Keep lane scales stable across brief pauses in a continuous gesture
export const VIEW_REST_MS = 400

// The narrowest stretch a coverage read covers, so an ordinary zoom around a gene is answered
// out of bytes already held rather than by a read of its own
export const COVERAGE_BLOCK_MIN = 1 << 20
// The furthest a block reaches past the view. Margin is what makes a pan free, but a block is
// parsed whole, and a chromosome of every track at once is a couple of million records
export const COVERAGE_BLOCK_MARGIN_MAX = 1 << 24
// Coverage-block margin as a multiple of the visible span
export const BLOCK_MARGIN_SPANS = 1.5
// Use a smaller margin for point-dense GWAS data
export const GWAS_BLOCK_MARGIN_SPANS = 0.25
// Records a column may be drawn from before the lane is read at a coarser stride
export const COVERAGE_RECORDS_PER_PX = 4

// How many columns one summary record may stand for before the lane goes back to reading records.
// A track's summaries start at whatever the file's coarsest author chose, so the choice at a given
// zoom is not summaries or detail, it is a profile a few columns blockier than the screen or the
// tens of thousands of records that would be drawn into those same columns anyway
export const SUMMARY_MAX_COLUMNS = 4

// A lane is painted this far outside the frame. A lane scrolled back in repaints itself where
// the view got to, so this is only cover for the frame that reveal lands on
export const LANE_REVEAL_PX = 96

// How long the plot's measured position stands during a stream of wheel events. Long enough
// that a pinch measures once, short enough that a scroll or a resize is picked up
export const WHEEL_MEASURE_MS = 200

// A drag shorter than this is a click, not a pan
export const DRAG_SLOP_PX = 4
// A shift-drag narrower than this is not a deliberate range selection
export const RANGE_SELECT_MIN_PX = 8

// Text drawn into a canvas, which cannot inherit the theme's sizes the way the DOM does
export const CANVAS_FONT_PX = 12
export const CANVAS_LABEL_PX = 12

export const SETTINGS_W = 284
// Align settings fields along the same right edge
export const SETTINGS_FIELD_W = 110

export const POPUP_DEFAULT_POS = { x: 29, y: 325 }
export const BIN_POPUP_W = 320
export const BIN_POPUP_H = 420
export const POPUP_MIN_W = 260
export const POPUP_MIN_H = 240
