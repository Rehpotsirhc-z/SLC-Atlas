// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useRef } from "react"
import { computeDendrogram } from "@/utils/dendrogram"
import type { DendroLayout, DendroNodeInput, DendroOrientation } from "@/utils/dendrogram"
import type { ClusterNode } from "@/types/clustering"
import { GENE_TREE_W } from "./constants"

export interface GeneRow {
  geneId: string
  symbol: string
  family: string | null
}

export function useDendroLeaves<N extends DendroNodeInput, T>(
  nodes: N[],
  orientation: DendroOrientation,
  step: number,
  depthSize: number,
  project: (node: N) => T | null,
): { tree: DendroLayout | null; items: T[] } {
  const tree = useMemo(
    () => computeDendrogram(nodes, orientation, step, depthSize),
    [nodes, orientation, step, depthSize],
  )

  const projectRef = useRef(project)
  projectRef.current = project

  const items = useMemo(() => {
    if (!tree) return []
    const byId = new Map<number, N>()
    for (const n of nodes) byId.set(n.node_id, n)
    return tree.order
      .map((id) => {
        const node = byId.get(id)
        return node ? projectRef.current(node) : null
      })
      .filter((v): v is T => v !== null)
  }, [tree, nodes])

  return { tree, items }
}

export function useGeneRows(clusterNodes: ClusterNode[], cellH: number) {
  const { tree: geneTree, items: geneRows } = useDendroLeaves(
    clusterNodes,
    "left",
    cellH,
    GENE_TREE_W,
    (n) =>
      n.gene_id ? { geneId: n.gene_id, symbol: n.symbol ?? n.gene_id, family: n.family } : null,
  )

  const rowByGene = useMemo(() => {
    const m = new Map<string, number>()
    geneRows.forEach((g, i) => m.set(g.geneId, i))
    return m
  }, [geneRows])

  return { geneTree, geneRows, rowByGene }
}
