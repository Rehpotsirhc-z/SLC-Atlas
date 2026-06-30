// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface DendroNodeInput {
  node_id: number
  parent_id: number | null
  branch_length: number
}

export type DendroOrientation = "left" | "top"

export interface DendroPlacedLeaf {
  id: number
  index: number
  cross: number // center coordinate along the leaf axis (px)
}

export interface DendroLayout {
  order: number[] // leaf node ids, in display order
  leaves: DendroPlacedLeaf[]
  pos: Map<number, { x: number; y: number }>
  edges: string // concatenated SVG path string
  maxDepth: number
}

interface RNode {
  id: number
  parent: number | null
  branchLength: number
  children: number[]
}

function buildTree(data: DendroNodeInput[]): { nodes: Map<number, RNode>; root: number } | null {
  const nodes = new Map<number, RNode>()
  for (const n of data) {
    nodes.set(n.node_id, {
      id: n.node_id,
      parent: n.parent_id,
      branchLength: n.branch_length,
      children: [],
    })
  }
  let root: number | null = null
  for (const n of nodes.values()) {
    if (n.parent === null) root = n.id
    else nodes.get(n.parent)?.children.push(n.id)
  }
  return root === null ? null : { nodes, root }
}

function postOrder(nodes: Map<number, RNode>, root: number): number[] {
  const out: number[] = []
  const stack: [number, boolean][] = [[root, false]]
  while (stack.length) {
    const [id, done] = stack.pop()!
    if (done) {
      out.push(id)
    } else {
      stack.push([id, true])
      for (const c of nodes.get(id)!.children) stack.push([c, false])
    }
  }
  return out
}

function depthAndLeafOrder(
  nodes: Map<number, RNode>,
  root: number,
): { depth: Map<number, number>; leaves: number[] } {
  const depth = new Map<number, number>([[root, 0]])
  const leaves: number[] = []
  const stack = [root]
  while (stack.length) {
    const id = stack.pop()!
    const n = nodes.get(id)!
    const d = depth.get(id)!
    if (n.children.length === 0) {
      leaves.push(id)
    } else {
      for (let i = n.children.length - 1; i >= 0; i--) {
        const c = n.children[i]
        depth.set(c, d + nodes.get(c)!.branchLength)
        stack.push(c)
      }
    }
  }
  return { depth, leaves }
}

const R = (v: number) => Math.round(v * 10) / 10

function connector(
  orientation: DendroOrientation,
  parent: { x: number; y: number },
  kids: { x: number; y: number }[],
): string {
  if (orientation === "left") {
    const k = [...kids].sort((a, b) => a.y - b.y)
    const px = parent.x
    const top = k[0]
    const bot = k[k.length - 1]
    let d = `M${R(top.x)} ${R(top.y)}L${R(px)} ${R(top.y)}L${R(px)} ${R(bot.y)}L${R(bot.x)} ${R(bot.y)}`
    for (let i = 1; i < k.length - 1; i++) d += `M${R(px)} ${R(k[i].y)}L${R(k[i].x)} ${R(k[i].y)}`
    return d
  }
  const k = [...kids].sort((a, b) => a.x - b.x)
  const py = parent.y
  const left = k[0]
  const right = k[k.length - 1]
  let d = `M${R(left.x)} ${R(left.y)}L${R(left.x)} ${R(py)}L${R(right.x)} ${R(py)}L${R(right.x)} ${R(right.y)}`
  for (let i = 1; i < k.length - 1; i++) d += `M${R(k[i].x)} ${R(py)}L${R(k[i].x)} ${R(k[i].y)}`
  return d
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
  const { depth, leaves } = depthAndLeafOrder(nodes, root)
  const maxDepth = Math.max(1e-9, ...leaves.map((l) => depth.get(l)!))

  const cross = new Map<number, number>()
  leaves.forEach((l, i) => cross.set(l, i * step + step / 2))
  for (const id of postOrder(nodes, root)) {
    const n = nodes.get(id)!
    if (n.children.length) {
      const cs = n.children.map((c) => cross.get(c)!)
      cross.set(id, (Math.min(...cs) + Math.max(...cs)) / 2)
    }
  }

  const pos = new Map<number, { x: number; y: number }>()
  for (const [id, n] of nodes) {
    const dfrac = n.children.length ? depth.get(id)! / maxDepth : 1
    const along = cross.get(id)!
    pos.set(
      id,
      orientation === "left"
        ? { x: dfrac * depthSize, y: along }
        : { x: along, y: dfrac * depthSize },
    )
  }

  let edges = ""
  for (const [id, n] of nodes) {
    if (!n.children.length) continue
    edges += connector(
      orientation,
      pos.get(id)!,
      n.children.map((c) => pos.get(c)!),
    )
  }

  return {
    order: leaves,
    leaves: leaves.map((id, index) => ({ id, index, cross: cross.get(id)! })),
    pos,
    edges,
    maxDepth,
  }
}
