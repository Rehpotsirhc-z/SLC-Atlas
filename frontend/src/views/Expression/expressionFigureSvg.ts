// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { buildHeatmapFigureSvg } from "@/components/heatmap/buildHeatmapFigureSvg"
import type { HeatmapFigureOptions } from "@/components/heatmap/buildHeatmapFigureSvg"
import { COL_LABEL_GAP } from "@/components/heatmap/constants"
import type { DendroLayout } from "@/utils/dendrogram"

type ExpressionFigureOptions = Omit<
  HeatmapFigureOptions,
  "geneTree" | "contentTop" | "colLabelY" | "columnTree"
> & { geneTree: DendroLayout | null }

export function buildExpressionFigureSvg(o: ExpressionFigureOptions): string | null {
  if (!o.geneTree || o.gridW === 0) return null
  return buildHeatmapFigureSvg({
    ...o,
    geneTree: o.geneTree,
    contentTop: COL_LABEL_GAP,
    colLabelY: COL_LABEL_GAP,
  })
}
