// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { buildHeatmapFigureSvg } from "@/components/heatmap/buildHeatmapFigureSvg"
import type { HeatmapFigureOptions } from "@/components/heatmap/buildHeatmapFigureSvg"
import { COL_LABEL_GAP, LEFT_W } from "@/components/heatmap/constants"
import { treePathSvg } from "@/components/heatmap/figureSvg"
import type { DendroLayout } from "@/utils/dendrogram"
import { SP_TREE_PAD, SPECIES_TREE_H, TOP_H } from "./constants"

type ConservationFigureOptions = Omit<
  HeatmapFigureOptions,
  "geneTree" | "topH" | "contentTop" | "colLabelY" | "columnTree"
> & {
  geneTree: DendroLayout | null
  speciesTree: DendroLayout | null
}

export function buildConservationFigureSvg({
  speciesTree,
  ...o
}: ConservationFigureOptions): string | null {
  if (!o.geneTree || !speciesTree || o.gridW === 0) return null
  return buildHeatmapFigureSvg({
    ...o,
    geneTree: o.geneTree,
    topH: TOP_H,
    contentTop: SP_TREE_PAD,
    colLabelY: SPECIES_TREE_H + COL_LABEL_GAP,
    columnTree: treePathSvg(speciesTree.edges, LEFT_W, SP_TREE_PAD, o.muted),
  })
}
