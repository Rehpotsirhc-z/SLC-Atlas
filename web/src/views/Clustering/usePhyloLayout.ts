// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from "react"
import { buildTree } from "@/utils/tree"
import type { ClusterNode } from "@/types/clustering"
import { computeLayout, RECT, type Layout, type LeafLayout } from "./phyloLayout"

export function usePhyloLayout(
  data: ClusterNode[],
  layout: Layout,
  containerW: number,
  rowH: number,
) {
  const layoutData = useMemo(() => {
    const tree = buildTree(data)
    if (!tree) return null
    const maxW = RECT.left + RECT.drawW + RECT.labelArea
    const w = Math.min(containerW || 600, maxW)
    const labelArea = Math.min(RECT.labelArea, Math.max(110, Math.round(w * 0.15)))
    const drawW = Math.max(200, w - RECT.left - labelArea)
    return computeLayout(tree, layout, drawW, labelArea, rowH)
  }, [data, layout, containerW, rowH])

  const leafByGene = useMemo(() => {
    const m = new Map<string, LeafLayout>()
    if (layoutData) for (const l of layoutData.leaves) if (l.geneId) m.set(l.geneId, l)
    return m
  }, [layoutData])

  const rectScale =
    layoutData && containerW > 0 ? Math.min(containerW, layoutData.width) / layoutData.width : 1

  return { layoutData, leafByGene, rectScale }
}
