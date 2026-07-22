// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  depthAndLeafOrder,
  levelOrder,
  midpointSpread,
  radialConnector,
  rectConnector,
} from "@/utils/tree"
import type { Tree } from "@/utils/tree"
import type { ClusterNode } from "@/types/clustering"

export type Layout = "rectangular" | "radial"

export interface LeafLayout {
  id: number
  x: number
  y: number
  angle: number | null
  symbol: string | null
  family: string | null
  geneId: string | null
}

export interface TreeLayout {
  width: number
  height: number
  edges: string
  leaves: LeafLayout[]
  maxDepth: number
  treeLeft: number
  treeRight: number
}

export const RECT = { rowH: 30, drawW: 950, left: 14, labelArea: 160, top: 20 }
export const RADIAL = { maxR: 560, labelMargin: 170 }

// Branch lengths this small mean the tree carries no distances, so depth falls back to level
const FLAT_EPSILON = 1e-6

interface Axes {
  depth: Map<number, number>
  leaves: number[]
  maxDepth: number
  flat: boolean
  level: Map<number, number>
  maxLevel: number
}

function depthAxes(tree: Tree<ClusterNode>): Axes {
  const { depth, leaves } = depthAndLeafOrder(tree)
  const maxDepth = Math.max(1e-9, ...leaves.map((l) => depth.get(l)!))
  const flat = maxDepth < FLAT_EPSILON
  const level = flat ? levelOrder(tree) : new Map<number, number>([[tree.root, 0]])
  return { depth, leaves, maxDepth, flat, level, maxLevel: Math.max(1, ...level.values()) }
}

function leafLayouts(
  tree: Tree<ClusterNode>,
  ids: number[],
  pos: Map<number, { x: number; y: number; angle: number | null }>,
): LeafLayout[] {
  return ids.map((id) => {
    const p = pos.get(id)!
    const n = tree.nodes.get(id)!
    return {
      id,
      x: p.x,
      y: p.y,
      angle: p.angle,
      symbol: n.data.symbol,
      family: n.data.family,
      geneId: n.data.gene_id,
    }
  })
}

function rectangularLayout(tree: Tree<ClusterNode>, axes: Axes, drawW: number, labelArea: number) {
  const { nodes } = tree
  const { depth, leaves, maxDepth, flat, level, maxLevel } = axes

  const xOf = (id: number) =>
    flat
      ? RECT.left + (level.get(id)! / maxLevel) * drawW
      : RECT.left + (depth.get(id)! / maxDepth) * drawW

  const y = new Map<number, number>()
  leaves.forEach((l, i) => y.set(l, RECT.top + i * RECT.rowH))
  midpointSpread(tree, y)

  const pos = new Map<number, { x: number; y: number; angle: number | null }>()
  for (const id of nodes.keys()) pos.set(id, { x: xOf(id), y: y.get(id)!, angle: null })

  let edges = ""
  for (const [id, n] of nodes) {
    if (!n.children.length) continue
    edges += rectConnector(
      pos.get(id)!.x,
      n.children.map((c) => ({ x: pos.get(c)!.x, y: pos.get(c)!.y })),
    )
  }

  return {
    width: RECT.left + drawW + labelArea,
    height: RECT.top * 2 + Math.max(1, leaves.length) * RECT.rowH,
    edges,
    leaves: leafLayouts(tree, leaves, pos),
    maxDepth,
    treeLeft: RECT.left,
    treeRight: RECT.left + drawW,
  }
}

function radialLayout(tree: Tree<ClusterNode>, axes: Axes) {
  const { nodes } = tree
  const { depth, leaves, maxDepth, flat, level, maxLevel } = axes

  const step = (2 * Math.PI) / Math.max(1, leaves.length)
  const angle = new Map<number, number>()
  leaves.forEach((l, i) => angle.set(l, -Math.PI / 2 + i * step))
  midpointSpread(tree, angle)

  const C = RADIAL.maxR + RADIAL.labelMargin
  const rOf = (id: number) =>
    flat ? (level.get(id)! / maxLevel) * RADIAL.maxR : (depth.get(id)! / maxDepth) * RADIAL.maxR

  const pos = new Map<number, { x: number; y: number; angle: number | null }>()
  for (const id of nodes.keys()) {
    const r = rOf(id)
    const a = angle.get(id)!
    pos.set(id, { x: C + r * Math.cos(a), y: C + r * Math.sin(a), angle: a })
  }

  let edges = ""
  for (const [id, n] of nodes) {
    if (!n.children.length) continue
    edges += radialConnector(
      C,
      rOf(id),
      n.children.map((c) => ({ angle: angle.get(c)!, r: rOf(c) })),
    )
  }

  return {
    width: 2 * C,
    height: 2 * C,
    edges,
    leaves: leafLayouts(tree, leaves, pos),
    maxDepth,
    treeLeft: 0,
    treeRight: 0,
  }
}

export function computeLayout(
  tree: Tree<ClusterNode>,
  layout: Layout,
  drawW = RECT.drawW,
  labelArea = RECT.labelArea,
): TreeLayout {
  const axes = depthAxes(tree)
  return layout === "rectangular"
    ? rectangularLayout(tree, axes, drawW, labelArea)
    : radialLayout(tree, axes)
}

export const isFlat = (maxDepth: number) => maxDepth < FLAT_EPSILON
