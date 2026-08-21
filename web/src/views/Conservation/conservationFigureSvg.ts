// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { buildHeatmapFigureSvg } from "@/components/heatmap/buildHeatmapFigureSvg"
import type { HeatmapFigureOptions } from "@/components/heatmap/buildHeatmapFigureSvg"
import { COL_LABEL_GAP, GENE_TREE_W } from "@/components/heatmap/constants"
import { treePathSvg } from "@/components/heatmap/figureSvg"
import type { DendroLayout } from "@/utils/dendrogram"
import { SP_TREE_PAD, SPECIES_TREE_H } from "./constants"

type ConservationFigureOptions = Omit<
  HeatmapFigureOptions,
  "geneTree" | "contentTop" | "colLabelY" | "columnTree"
> & {
  geneTree: DendroLayout | null
  speciesTree: DendroLayout | null
  showSpeciesTree: boolean
}

export function buildConservationFigureSvg({
  speciesTree,
  showSpeciesTree,
  ...o
}: ConservationFigureOptions): string | null {
  if (!o.geneTree || !speciesTree || o.gridW === 0) return null
  const leftW = (o.showGeneTree ? GENE_TREE_W : 0) + o.geneLabelW
  return buildHeatmapFigureSvg({
    ...o,
    geneTree: o.geneTree,
    contentTop: showSpeciesTree ? SP_TREE_PAD : COL_LABEL_GAP,
    colLabelY: showSpeciesTree ? SPECIES_TREE_H + COL_LABEL_GAP : COL_LABEL_GAP,
    columnTree: showSpeciesTree
      ? treePathSvg(speciesTree.edges, leftW, SP_TREE_PAD, o.muted)
      : undefined,
  })
}
