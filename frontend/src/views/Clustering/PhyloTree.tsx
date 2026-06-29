// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material"
import { getFamilyColor } from "@/utils/familyColor"
import { triggerDownload } from "@/utils/download"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"

export type Layout = "rectangular" | "radial"

export interface PhyloTreeHandle {
  exportSvg: (filename: string) => void
  exportPng: (filename: string) => void
  resetView: () => void
  focusGene: (geneId: string) => void
  focusFamily: (family: string) => void
}

interface PhyloTreeProps {
  data: ClusterNode[]
  layout: Layout
  familyFilter: string | null
  selectedGeneId: string | null
  onSelect: (geneId: string | null) => void
  geneById: Map<string, Gene>
}

// Tree Model
interface RNode {
  id: number
  parent: number | null
  branchLength: number
  geneId: string | null
  symbol: string | null
  family: string | null
  children: number[]
}

interface Tree {
  nodes: Map<number, RNode>
  root: number
}

function buildTree(data: ClusterNode[]): Tree | null {
  const nodes = new Map<number, RNode>()
  for (const n of data) {
    nodes.set(n.node_id, {
      id: n.node_id,
      parent: n.parent_id,
      branchLength: n.branch_length,
      geneId: n.gene_id,
      symbol: n.symbol,
      family: n.family,
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


// Layout
interface LeafLayout {
  id: number
  x: number
  y: number
  angle: number | null
  symbol: string | null
  family: string | null
  geneId: string | null
}

interface TreeLayout {
  width: number
  height: number
  edges: string
  leaves: LeafLayout[]
}

const RECT = { rowH: 30, drawW: 950, left: 14, labelArea: 160, top: 20 }
const RADIAL = { maxR: 560, labelMargin: 170 }
const R = (v: number) => Math.round(v * 10) / 10

function rectConnector(px: number, kids: { x: number; y: number }[]): string {
  const k = [...kids].sort((a, b) => a.y - b.y)
  const top = k[0]
  const bot = k[k.length - 1]
  let d = `M${R(top.x)} ${R(top.y)}L${R(px)} ${R(top.y)}L${R(px)} ${R(bot.y)}L${R(bot.x)} ${R(bot.y)}`
  for (let i = 1; i < k.length - 1; i++) d += `M${R(px)} ${R(k[i].y)}L${R(k[i].x)} ${R(k[i].y)}`
  return d
}

function radialConnector(C: number, pr: number, kids: { angle: number; r: number }[]): string {
  const x = (r: number, a: number) => R(C + r * Math.cos(a))
  const y = (r: number, a: number) => R(C + r * Math.sin(a))

  if (pr < 0.01) {
    const c = [...kids].sort((a, b) => a.angle - b.angle)
    const last = c.length - 1
    let d = `M${x(c[0].r, c[0].angle)} ${y(c[0].r, c[0].angle)}L${R(C)} ${R(C)}L${x(c[last].r, c[last].angle)} ${y(c[last].r, c[last].angle)}`
    for (let i = 1; i < last; i++)
      d += `M${R(C)} ${R(C)}L${x(c[i].r, c[i].angle)} ${y(c[i].r, c[i].angle)}`
    return d
  }

  const k = [...kids].sort((a, b) => a.angle - b.angle)
  const a0 = k[0].angle
  const a1 = k[k.length - 1].angle
  const largeArc = a1 - a0 > Math.PI ? 1 : 0
  let d =
    `M${x(k[0].r, a0)} ${y(k[0].r, a0)}L${x(pr, a0)} ${y(pr, a0)}` +
    `A${R(pr)} ${R(pr)} 0 ${largeArc} 1 ${x(pr, a1)} ${y(pr, a1)}` +
    `L${x(k[k.length - 1].r, a1)} ${y(k[k.length - 1].r, a1)}`

  for (let i = 1; i < k.length - 1; i++) {
    d += `M${x(pr, k[i].angle)} ${y(pr, k[i].angle)}L${x(k[i].r, k[i].angle)} ${y(k[i].r, k[i].angle)}`
  }

  return d
}

function postOrder(tree: Tree): number[] {
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

function depthAndLeafOrder(tree: Tree): { depth: Map<number, number>; leaves: number[] } {
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

function computeLayout(
  tree: Tree,
  layout: Layout,
  drawW = RECT.drawW,
  labelArea = RECT.labelArea,
): TreeLayout {
  const { nodes } = tree
  const { depth, leaves } = depthAndLeafOrder(tree)
  const maxDepth = Math.max(1e-9, ...leaves.map((l) => depth.get(l)!))
  const pos = new Map<number, { x: number; y: number; angle: number | null }>()
  const order = postOrder(tree)

  if (layout === "rectangular") {
    const x = (id: number) => RECT.left + (depth.get(id)! / maxDepth) * drawW
    const y = new Map<number, number>()

    leaves.forEach((l, i) => y.set(l, RECT.top + i * RECT.rowH))

    for (const id of order) {
      const n = nodes.get(id)!
      if (n.children.length) {
        const ys = n.children.map((c) => y.get(c)!)
        y.set(id, (Math.min(...ys) + Math.max(...ys)) / 2)
      }
    }

    for (const id of nodes.keys()) pos.set(id, { x: x(id), y: y.get(id)!, angle: null })

    let edges = ""
    for (const [id, n] of nodes) {
      if (!n.children.length) continue
      const px = pos.get(id)!.x
      const kids = n.children.map((c) => {
        const cp = pos.get(c)!
        return { x: cp.x, y: cp.y }
      })
      edges += rectConnector(px, kids)
    }

    const leafLayouts = leaves.map((id) => {
      const p = pos.get(id)!
      const n = nodes.get(id)!
      return {
        id,
        x: p.x,
        y: p.y,
        angle: null,
        symbol: n.symbol,
        family: n.family,
        geneId: n.geneId,
      }
    })

    return {
      width: RECT.left + drawW + labelArea,
      height: RECT.top * 2 + Math.max(1, leaves.length) * RECT.rowH,
      edges,
      leaves: leafLayouts,
    }
  }

  const nL = leaves.length
  const step = (2 * Math.PI) / Math.max(1, nL)
  const angle = new Map<number, number>()

  leaves.forEach((l, i) => angle.set(l, -Math.PI / 2 + i * step))

  for (const id of order) {
    const n = nodes.get(id)!
    if (n.children.length) {
      const a = n.children.map((c) => angle.get(c)!)
      angle.set(id, (Math.min(...a) + Math.max(...a)) / 2)
    }
  }

  const C = RADIAL.maxR + RADIAL.labelMargin
  const rOf = (id: number) => (depth.get(id)! / maxDepth) * RADIAL.maxR

  for (const id of nodes.keys()) {
    const r = rOf(id)
    const a = angle.get(id)!
    pos.set(id, { x: C + r * Math.cos(a), y: C + r * Math.sin(a), angle: a })
  }

  let edges = ""
  for (const [id, n] of nodes) {
    if (!n.children.length) continue
    const pr = rOf(id)
    const kids = n.children.map((c) => ({ angle: angle.get(c)!, r: rOf(c) }))
    edges += radialConnector(C, pr, kids)
  }

  const leafLayouts = leaves.map((id) => {
    const p = pos.get(id)!
    const n = nodes.get(id)!
    return {
      id,
      x: p.x,
      y: p.y,
      angle: p.angle,
      symbol: n.symbol,
      family: n.family,
      geneId: n.geneId,
    }
  })

  return { width: 2 * C, height: 2 * C, edges, leaves: leafLayouts }
}

interface Transform {
  k: number
  x: number
  y: number
}

const PhyloTree = forwardRef<PhyloTreeHandle, PhyloTreeProps>(function PhyloTree(
  { data, layout, familyFilter, selectedGeneId, onSelect, geneById },
  ref,
) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const mode = theme.palette.mode
  const monoFont = theme.custom.monoFontFamily
  const edgeColor = mode === "dark" ? "#5B6268" : "#9ca0a4"
  const bgColor = theme.palette.background.paper
  const isRadial = layout === "radial"

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const treeGroupRef = useRef<SVGGElement>(null)
  const drag = useRef({ active: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const fitScale = useRef(1)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{
    dist: number
    cx: number
    cy: number
    k: number
    tx: number
    ty: number
  } | null>(null)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<{ leaf: LeafLayout; sx: number; sy: number } | null>(null)

  const layoutData = useMemo(() => {
    const tree = buildTree(data)
    if (!tree) return null
    return isMobile ? computeLayout(tree, layout, 300, 120) : computeLayout(tree, layout)
  }, [data, layout, isMobile])

  const leafByGene = useMemo(() => {
    const m = new Map<string, LeafLayout>()
    if (layoutData) for (const l of layoutData.leaves) if (l.geneId) m.set(l.geneId, l)
    return m
  }, [layoutData])

  const rectScale =
    layoutData && size.w > 0 ? Math.min(size.w, layoutData.width) / layoutData.width : 1

  // Measure container
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(() => {
    if (!isRadial || !layoutData || size.w === 0 || size.h === 0) return
    const s = Math.min(size.w / layoutData.width, size.h / layoutData.height) * 0.92
    fitScale.current = s
    setTransform({
      k: s,
      x: (size.w - layoutData.width * s) / 2,
      y: (size.h - layoutData.height * s) / 2,
    })
  }, [isRadial, layoutData, size])

  // Refit when the tree or container changes
  useEffect(() => {
    fit()
  }, [fit])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !isRadial) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      setTransform((t) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
        const k = Math.min(fitScale.current * 80, Math.max(fitScale.current * 0.5, t.k * factor))
        const vx = (sx - t.x) / t.k
        const vy = (sy - t.y) / t.k
        return { k, x: sx - vx * k, y: sy - vy * k }
      })
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [isRadial])

  const nearestLeaf = useCallback(
    (clientX: number, clientY: number): { leaf: LeafLayout; sx: number; sy: number } | null => {
      if (!layoutData || !svgRef.current || !containerRef.current) return null
      const svgRect = svgRef.current.getBoundingClientRect()
      const scale = isRadial ? transform.k : rectScale
      const vx = isRadial
        ? (clientX - svgRect.left - transform.x) / transform.k
        : (clientX - svgRect.left) / scale
      const vy = isRadial
        ? (clientY - svgRect.top - transform.y) / transform.k
        : (clientY - svgRect.top) / scale

      let best: LeafLayout | null = null
      if (isRadial) {
        const C = RADIAL.maxR + RADIAL.labelMargin
        const radius = Math.hypot(vx - C, vy - C)
        if (radius >= RADIAL.maxR * 0.08) {
          const ang = Math.atan2(vy - C, vx - C)
          let bestDiff = Infinity
          for (const l of layoutData.leaves) {
            if (l.angle === null) continue
            const diff = Math.abs(Math.atan2(Math.sin(ang - l.angle), Math.cos(ang - l.angle)))
            if (diff < bestDiff) {
              bestDiff = diff
              best = l
            }
          }
        }
      } else {
        let bestDiff = Infinity
        for (const l of layoutData.leaves) {
          const d = Math.abs(l.y - vy)
          if (d < bestDiff) {
            bestDiff = d
            best = l
          }
        }
        if (best && bestDiff > RECT.rowH * 0.6) best = null
      }
      if (!best) return null
      const crect = containerRef.current.getBoundingClientRect()
      return { leaf: best, sx: clientX - crect.left, sy: clientY - crect.top }
    },
    [layoutData, transform, isRadial, size, rectScale],
  )

  const focusGene = useCallback(
    (geneId: string) => {
      if (!layoutData || size.w === 0) return
      const leaf = leafByGene.get(geneId)
      if (!leaf) return
      if (isRadial) {
        setTransform((t) => {
          const k = Math.max(t.k, 1)
          return { k, x: size.w / 2 - leaf.x * k, y: size.h / 2 - leaf.y * k }
        })
      } else {
        containerRef.current?.scrollTo({ top: leaf.y * rectScale - size.h / 2, behavior: "smooth" })
      }
    },
    [layoutData, size, isRadial, leafByGene, rectScale],
  )

  const focusFamily = useCallback(
    (family: string) => {
      if (!layoutData || size.w === 0) return
      const familyLeaves = layoutData.leaves.filter((l) => l.family === family)
      if (familyLeaves.length === 0) return
      if (!isRadial) {
        const ys = familyLeaves.map((l) => l.y).sort((a, b) => a - b)
        const medianY = ys[Math.floor(ys.length / 2)]
        containerRef.current?.scrollTo({ top: medianY * rectScale - size.h / 2, behavior: "smooth" })
      }
    },
    [layoutData, size, isRadial, rectScale],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (isRadial) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      svgRef.current?.setPointerCapture(e.pointerId)
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]
        const rect = svgRef.current!.getBoundingClientRect()
        pinch.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          cx: (a.x + b.x) / 2 - rect.left,
          cy: (a.y + b.y) / 2 - rect.top,
          k: transform.k,
          tx: transform.x,
          ty: transform.y,
        }
        drag.current.active = false
        drag.current.moved = true // a pinch should never trigger a click-select
        return
      }
    }
    drag.current = {
      active: isRadial,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
      ox: transform.x,
      oy: transform.y,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (pinch.current && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()]
        const rect = svgRef.current!.getBoundingClientRect()
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const mx = (a.x + b.x) / 2 - rect.left
        const my = (a.y + b.y) / 2 - rect.top
        const p = pinch.current
        const k = Math.min(
          fitScale.current * 80,
          Math.max(fitScale.current * 0.5, p.k * (dist / p.dist)),
        )
        const vx = (p.cx - p.tx) / p.k
        const vy = (p.cy - p.ty) / p.k
        setTransform({ k, x: mx - vx * k, y: my - vy * k })
        setHover(null)
      }
      return
    }
    if (drag.current.active) {
      const dx = e.clientX - drag.current.sx
      const dy = e.clientY - drag.current.sy
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true
      setTransform((t) => ({ ...t, x: drag.current.ox + dx, y: drag.current.oy + dy }))
    } else {
      if (
        e.buttons > 0 &&
        (Math.abs(e.clientX - drag.current.sx) > 3 || Math.abs(e.clientY - drag.current.sy) > 3)
      ) {
        drag.current.moved = true // prevent click selection when dragging
      }
      setHover(nearestLeaf(e.clientX, e.clientY))
    }
  }

  const reset = useCallback(() => {
    if (isRadial) fit()
    else containerRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [isRadial, fit])

  const onPointerUp = (e: React.PointerEvent) => {
    if (isRadial) {
      pointers.current.delete(e.pointerId)
      svgRef.current?.releasePointerCapture(e.pointerId)
      if (pointers.current.size < 2) pinch.current = null
      if (pointers.current.size === 1) {
        // One finger remains after a pinch — hand control back to panning.
        const [rem] = [...pointers.current.values()]
        drag.current = {
          active: true,
          moved: true,
          sx: rem.x,
          sy: rem.y,
          ox: transform.x,
          oy: transform.y,
        }
        return
      }
    }
    const wasDrag = drag.current.moved
    drag.current.active = false
    if (!wasDrag) {
      const hit = nearestLeaf(e.clientX, e.clientY)
      if (hit?.leaf.geneId) onSelect(hit.leaf.geneId)
    }
  }

  // Exporting
  const buildSvgString = useCallback((): string | null => {
    if (!treeGroupRef.current || !layoutData) return null
    const clone = treeGroupRef.current.cloneNode(true) as SVGGElement
    clone.removeAttribute("transform")
    const { width: w, height: h } = layoutData
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bgColor}"/>${clone.outerHTML}</svg>`
  }, [layoutData, bgColor])

  useImperativeHandle(
    ref,
    () => ({
      resetView: reset,
      focusGene,
      focusFamily,
      exportSvg: (filename) => {
        const svg = buildSvgString()
        if (!svg) return
        triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), filename)
      },
      exportPng: (filename) => {
        const svg = buildSvgString()
        if (!svg || !layoutData) return
        const scale = 2
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          canvas.width = layoutData.width * scale
          canvas.height = layoutData.height * scale
          const ctx = canvas.getContext("2d")!
          ctx.scale(scale, scale)
          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) triggerDownload(blob, filename)
            URL.revokeObjectURL(url)
          }, "image/png")
        }
        img.src = url
      },
    }),
    [buildSvgString, layoutData, reset, focusGene, focusFamily],
  )

  // Static Tree (memoized)
  const staticTree = useMemo(() => {
    if (!layoutData) return null
    return (
      <g ref={treeGroupRef}>
        <path
          d={layoutData.edges}
          stroke={edgeColor}
          strokeWidth={0.6}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="butt"
        />
        {layoutData.leaves.map((l) => (
          <LeafLabel
            key={l.id}
            leaf={l}
            monoFont={monoFont}
            mode={mode}
            dim={familyFilter !== null && l.family !== familyFilter}
          />
        ))}
      </g>
    )
  }, [layoutData, edgeColor, monoFont, mode, familyFilter])

  if (!layoutData) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="text.secondary">No tree to display.</Typography>
      </Box>
    )
  }

  const selectedLeaf = selectedGeneId ? leafByGene.get(selectedGeneId) : undefined
  const hoverGene = hover?.leaf.geneId ? geneById.get(hover.leaf.geneId) : undefined

  const content = (
    <>
      {staticTree}
      <g>
        {selectedLeaf && <Highlight leaf={selectedLeaf} color={theme.palette.primary.main} />}
        {hover && hover.leaf.geneId !== selectedGeneId && (
          <Highlight leaf={hover.leaf} color={theme.palette.text.primary} />
        )}
      </g>
    </>
  )

  const svgCommon = {
    ref: svgRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick: reset,
    onPointerLeave: () => {
      setHover(null)
      drag.current.active = false
    },
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflowY: isRadial ? "hidden" : "auto",
        overflowX: "hidden",
        userSelect: "none",
      }}
    >
      {isRadial ? (
        <svg
          {...svgCommon}
          width={size.w}
          height={size.h}
          style={{
            display: "block",
            cursor: drag.current.active ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {content}
          </g>
        </svg>
      ) : (
        <svg
          {...svgCommon}
          width={layoutData.width * rectScale}
          height={layoutData.height * rectScale}
          viewBox={`0 0 ${layoutData.width} ${layoutData.height}`}
          style={{ display: "block", margin: "0 auto" }}
        >
          {content}
        </svg>
      )}
      {hover && (
        <Box
          sx={{
            position: "absolute",
            left: hover.sx + 14,
            top: hover.sy + 14,
            pointerEvents: "none",
            bgcolor: "background.default",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            px: 1,
            py: 0.5,
            maxWidth: 260,
            boxShadow: 3,
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontFamily: monoFont, display: "block", fontWeight: 600, fontSize: 13 }}
          >
            {hover.leaf.symbol}
          </Typography>
          {hoverGene?.name && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                textAlign: "justify",
              }}
            >
              {hoverGene.name}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontSize: 13 }}>
            <Box component="span" sx={{ fontFamily: monoFont, fontWeight: 600 }}>
              {hover.leaf.family}
            </Box>
            {hoverGene?.category && (
              <Box component="span" sx={{ color: "text.secondary" }}>
                <Box
                  component="span"
                  sx={{
                    mx: 0.25,
                    fontWeight: 700,
                    fontSize: 15,
                    verticalAlign: "middle",
                  }}
                >
                  {" \u00B7 "}
                </Box>
                {hoverGene.category}
              </Box>
            )}
          </Typography>
        </Box>
      )}
    </Box>
  )
})

function LeafLabel({
  leaf,
  monoFont,
  mode,
  dim,
}: {
  leaf: LeafLayout
  monoFont: string
  mode: "light" | "dark"
  dim: boolean
}) {
  const dimColor = mode === "dark" ? "#4a4f55" : "#d0d0d0"
  const color = dim ? dimColor : getFamilyColor(leaf.family ?? "?", mode)
  if (leaf.angle === null) {
    return (
      <g>
        <circle cx={leaf.x} cy={leaf.y} r={4.5} fill={color} />
        <text x={leaf.x + 10} y={leaf.y + 5.5} fontSize={16} fontFamily={monoFont} fill={color}>
          {leaf.symbol}
        </text>
      </g>
    )
  }
  const deg = (leaf.angle * 180) / Math.PI
  const flip = Math.cos(leaf.angle) < 0
  return (
    <g>
      <circle cx={leaf.x} cy={leaf.y} r={2.2} fill={color} />
      <text
        x={flip ? leaf.x - 5 : leaf.x + 5}
        y={leaf.y}
        dy={2.6}
        fontSize={8}
        fontFamily={monoFont}
        fill={color}
        textAnchor={flip ? "end" : "start"}
        transform={`rotate(${flip ? deg + 180 : deg} ${leaf.x} ${leaf.y})`}
      >
        {leaf.symbol}
      </text>
    </g>
  )
}

function Highlight({ leaf, color }: { leaf: LeafLayout; color: string }) {
  const r = leaf.angle === null ? 7 : 5
  return <circle cx={leaf.x} cy={leaf.y} r={r} fill="none" stroke={color} strokeWidth={2} />
}

export default PhyloTree
