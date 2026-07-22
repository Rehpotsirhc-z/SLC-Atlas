// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface TreeNodeInput {
  node_id: number
  parent_id: number | null
  branch_length: number
}

export interface TreeNode<T> {
  id: number
  parent: number | null
  branchLength: number
  data: T
  children: number[]
}

export interface Tree<T> {
  nodes: Map<number, TreeNode<T>>
  root: number
}

export function buildTree<T extends TreeNodeInput>(data: T[]): Tree<T> | null {
  const nodes = new Map<number, TreeNode<T>>()
  for (const n of data) {
    nodes.set(n.node_id, {
      id: n.node_id,
      parent: n.parent_id,
      branchLength: n.branch_length,
      data: n,
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

export function postOrder<T>(tree: Tree<T>): number[] {
  const out: number[] = []
  const stack: [number, boolean][] = [[tree.root, false]]
  while (stack.length) {
    const [id, done] = stack.pop()!
    if (done) {
      out.push(id)
    } else {
      stack.push([id, true])
      for (const c of tree.nodes.get(id)!.children) stack.push([c, false])
    }
  }
  return out
}

export function depthAndLeafOrder<T>(tree: Tree<T>): {
  depth: Map<number, number>
  leaves: number[]
} {
  const depth = new Map<number, number>([[tree.root, 0]])
  const leaves: number[] = []
  const stack = [tree.root]
  while (stack.length) {
    const id = stack.pop()!
    const n = tree.nodes.get(id)!
    const d = depth.get(id)!
    if (n.children.length === 0) {
      leaves.push(id)
    } else {
      for (let i = n.children.length - 1; i >= 0; i--) {
        const c = n.children[i]
        depth.set(c, d + tree.nodes.get(c)!.branchLength)
        stack.push(c)
      }
    }
  }
  return { depth, leaves }
}

export function levelOrder<T>(tree: Tree<T>): Map<number, number> {
  const level = new Map<number, number>([[tree.root, 0]])
  const stack = [tree.root]
  while (stack.length) {
    const id = stack.pop()!
    const l = level.get(id)!
    for (const c of tree.nodes.get(id)!.children) {
      level.set(c, l + 1)
      stack.push(c)
    }
  }
  return level
}

export function midpointSpread<T>(tree: Tree<T>, value: Map<number, number>): Map<number, number> {
  for (const id of postOrder(tree)) {
    const n = tree.nodes.get(id)!
    if (n.children.length) {
      const vs = n.children.map((c) => value.get(c)!)
      value.set(id, (Math.min(...vs) + Math.max(...vs)) / 2)
    }
  }
  return value
}

export const R = (v: number) => Math.round(v * 10) / 10

export interface BracketKid {
  along: number
  depth: number
}

export type BracketPoint = (along: number, depth: number) => string

export const depthAcrossX: BracketPoint = (along, depth) => `${R(depth)} ${R(along)}`
export const depthDownY: BracketPoint = (along, depth) => `${R(along)} ${R(depth)}`

export function bracketConnector(
  point: BracketPoint,
  parentDepth: number,
  kids: BracketKid[],
): string {
  const k = [...kids].sort((a, b) => a.along - b.along)
  const first = k[0]
  const last = k[k.length - 1]
  let d =
    `M${point(first.along, first.depth)}L${point(first.along, parentDepth)}` +
    `L${point(last.along, parentDepth)}L${point(last.along, last.depth)}`
  for (let i = 1; i < k.length - 1; i++)
    d += `M${point(k[i].along, parentDepth)}L${point(k[i].along, k[i].depth)}`
  return d
}

export function rectConnector(px: number, kids: { x: number; y: number }[]): string {
  return bracketConnector(
    depthAcrossX,
    px,
    kids.map((k) => ({ along: k.y, depth: k.x })),
  )
}
