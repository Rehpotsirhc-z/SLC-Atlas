// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// The app's standard gutter, theme.spacing(2), so the panel reads like every other view
export const EDGE_PAD = 16

export const GUTTER_W = 168
export const GUTTER_W_SM = 118

export const RULER_H = 38
export const LANE_GAP = 2

export const LANE_HEIGHT_DEFAULT = 64
export const LANE_HEIGHT_MIN = 32
export const LANE_HEIGHT_MAX = 160

export const GWAS_LANE_HEIGHT = 112
export const GWAS_POINT_R = 2.5
// The conventional genome-wide significance threshold
export const GWAS_SIGNIFICANCE_P = 5e-8

export const GENE_ROW_H = 19
export const GENE_TRACK_PAD = 8
export const GENE_TRACK_MIN_H = 74
export const GENE_TRACK_MAX_H = 264
export const MAX_GENE_ROWS = 40
// Room a label needs before it is worth drawing at all
export const LABEL_MIN_PX = 38
export const LABEL_GAP_PX = 6

export const EXON_H = 13
export const UTR_H = 7
export const ARROW_H = 9
// Below this an arrowhead reads as a blob rather than a direction, so the gene is a plain line
export const MIN_ARROW_PX = 3
// Bases per chevron along an intron, in pixels
export const CHEVRON_SPACING = 46

// A feature narrower than this would vanish, so it is drawn at this width instead
export const MIN_FEATURE_PX = 1.5

// Autoscale leaves a little air above the tallest bar so the peak is not clipped
export const Y_HEADROOM = 1.08

// Past this the whole exon structure of a transcript is a pixel or two of chain, and a
// chromosome holds tens of thousands of them, so the track draws one row per gene instead
export const TRANSCRIPT_MAX_SPAN = 4_000_000

// Past this a study holds more variants than a drag can repaint, so the lane reads the
// overview the build wrote beside it. The suffix is the one build_browser.py named
export const GWAS_FULL_MAX_SPAN = 4_000_000
export const GWAS_OVERVIEW_SUFFIX = ".overview"
export const GWAS_OVERVIEW_BIN = 10_000

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
// Records a column may be drawn from before the lane is read at a coarser stride
export const COVERAGE_RECORDS_PER_PX = 4

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
