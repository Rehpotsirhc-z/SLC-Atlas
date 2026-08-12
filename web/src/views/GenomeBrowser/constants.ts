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
// Bases per chevron along an intron, in pixels
export const CHEVRON_SPACING = 46

// A feature narrower than this would vanish, so it is drawn at this width instead
export const MIN_FEATURE_PX = 1.5

// Autoscale leaves a little air above the tallest bar so the peak is not clipped
export const Y_HEADROOM = 1.08

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

// A gesture arriving as a burst of events is published once, this long after it stops. Every
// publication renders the whole stack and asks for whatever the new window needs, neither of
// which belongs inside a movement the eye reads as continuous
export const VIEW_SETTLE_MS = 140

// The narrowest stretch a coverage read covers. A block is a power of two wide, so every zoom
// short of this one lands inside the bytes already held and costs no read at all
export const COVERAGE_BLOCK_MIN = 1 << 20
// Records a column may be drawn from before the lane is read at a coarser stride
export const COVERAGE_RECORDS_PER_PX = 4

// A drag shorter than this is a click, not a pan
export const DRAG_SLOP_PX = 4
// A shift-drag narrower than this is not a deliberate range selection
export const RANGE_SELECT_MIN_PX = 8

// Text drawn into a canvas, which cannot inherit the theme's sizes the way the DOM does
export const CANVAS_FONT_PX = 12
export const CANVAS_LABEL_PX = 12

export const SETTINGS_W = 284
