// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  bracketConnector,
  buildTree,
  depthAcrossX,
  depthAndLeafOrder,
  depthDownY,
  levelOrder,
  midpointSpread,
} from "./tree"
import type { BracketKid, TreeNodeInput } from "./tree"

export type DendroNodeInput = TreeNodeInput

export type DendroOrientation = "left" | "top"

export interface DendroLayout {
  order: number[] // leaf node ids, in display order
  edges: string // concatenated SVG path string
}

export function computeDendrogram(
  data: DendroNodeInput[],
  orientation: DendroOrientation,
  step: number, // distance between adjacent leaf centers (cell width/height)
  depthSize: number, // px spanned by the depth axis
): DendroLayout | null {
  const tree = buildTree(data)
  if (!tree) return null
  const { nodes, root } = tree
  const { depth, leaves } = depthAndLeafOrder(tree)
  const maxDepth = Math.max(1e-9, ...leaves.map((l) => depth.get(l)!))

  const flat = maxDepth < 1e-6
  const level = flat ? levelOrder(tree) : new Map<number, number>([[root, 0]])
  const maxLevel = Math.max(1, ...level.values())

  const cross = new Map<number, number>()
  leaves.forEach((l, i) => cross.set(l, i * step + step / 2))
  midpointSpread(tree, cross)

  const geom = new Map<number, BracketKid>()
  for (const [id, n] of nodes) {
    const dfrac = n.children.length
      ? flat
        ? level.get(id)! / maxLevel
        : depth.get(id)! / maxDepth
      : 1
    geom.set(id, { along: cross.get(id)!, depth: dfrac * depthSize })
  }

  const left = orientation === "left"
  const point = left ? depthAcrossX : depthDownY
  let edges = ""
  for (const [id, n] of nodes) {
    if (!n.children.length) continue
    edges += bracketConnector(
      point,
      geom.get(id)!.depth,
      n.children.map((c) => geom.get(c)!),
    )
  }

  return { order: leaves, edges }
}
