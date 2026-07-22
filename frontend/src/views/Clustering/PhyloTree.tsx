// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"
import { getFamilyColor } from "@/utils/familyColor"
import { figureExportHandlers } from "@/utils/exportFigure"
import { useElementSize } from "@/utils/useElementSize"
import {
  R,
  buildTree,
  depthAndLeafOrder,
  levelOrder,
  midpointSpread,
  rectConnector,
} from "@/utils/tree"
import type { Tree } from "@/utils/tree"
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
  maxDepth: number
  treeLeft: number
  treeRight: number
}

const AXIS_H = 32

function niceAxisTicks(maxVal: number): number[] {
  if (maxVal <= 0) return [0]
  const step = 0.1
  const count = Math.floor(maxVal / step)
  const ticks = Array.from({ length: count + 1 }, (_, i) => Math.round(i * step * 1e10) / 1e10)
  if (Math.abs(ticks[ticks.length - 1] - maxVal) > step * 0.01) ticks.push(maxVal)
  return ticks
}

function formatTick(v: number): string {
  return parseFloat(v.toFixed(2)).toString()
}

const RECT = { rowH: 30, drawW: 950, left: 14, labelArea: 160, top: 20 }
const RADIAL = { maxR: 560, labelMargin: 170 }

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

function computeLayout(
  tree: Tree<ClusterNode>,
  layout: Layout,
  drawW = RECT.drawW,
  labelArea = RECT.labelArea,
): TreeLayout {
  const { nodes } = tree
  const { depth, leaves } = depthAndLeafOrder(tree)
  const maxDepth = Math.max(1e-9, ...leaves.map((l) => depth.get(l)!))
  const flat = maxDepth < 1e-6

  const level = flat ? levelOrder(tree) : new Map<number, number>([[tree.root, 0]])
  const maxLevel = Math.max(1, ...level.values())
  const pos = new Map<number, { x: number; y: number; angle: number | null }>()

  if (layout === "rectangular") {
    const x = (id: number) =>
      flat
        ? RECT.left + (level.get(id)! / maxLevel) * drawW
        : RECT.left + (depth.get(id)! / maxDepth) * drawW
    const y = new Map<number, number>()

    leaves.forEach((l, i) => y.set(l, RECT.top + i * RECT.rowH))
    midpointSpread(tree, y)

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
        symbol: n.data.symbol,
        family: n.data.family,
        geneId: n.data.gene_id,
      }
    })

    return {
      width: RECT.left + drawW + labelArea,
      height: RECT.top * 2 + Math.max(1, leaves.length) * RECT.rowH,
      edges,
      leaves: leafLayouts,
      maxDepth,
      treeLeft: RECT.left,
      treeRight: RECT.left + drawW,
    }
  }

  const nL = leaves.length
  const step = (2 * Math.PI) / Math.max(1, nL)
  const angle = new Map<number, number>()

  leaves.forEach((l, i) => angle.set(l, -Math.PI / 2 + i * step))
  midpointSpread(tree, angle)

  const C = RADIAL.maxR + RADIAL.labelMargin
  const rOf = (id: number) =>
    flat ? (level.get(id)! / maxLevel) * RADIAL.maxR : (depth.get(id)! / maxDepth) * RADIAL.maxR

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
      symbol: n.data.symbol,
      family: n.data.family,
      geneId: n.data.gene_id,
    }
  })

  return {
    width: 2 * C,
    height: 2 * C,
    edges,
    leaves: leafLayouts,
    maxDepth,
    treeLeft: 0,
    treeRight: 0,
  }
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

  const [containerRef, size] = useElementSize<HTMLDivElement>()
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

  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<{
    leaf: LeafLayout
    clientX: number
    clientY: number
  } | null>(null)

  const layoutData = useMemo(() => {
    const tree = buildTree(data)
    if (!tree) return null
    const maxW = RECT.left + RECT.drawW + RECT.labelArea
    const w = Math.min(size.w || 600, maxW)
    const labelArea = Math.min(RECT.labelArea, Math.max(110, Math.round(w * 0.15)))
    const drawW = Math.max(200, w - RECT.left - labelArea)
    return computeLayout(tree, layout, drawW, labelArea)
  }, [data, layout, size.w])

  const leafByGene = useMemo(() => {
    const m = new Map<string, LeafLayout>()
    if (layoutData) for (const l of layoutData.leaves) if (l.geneId) m.set(l.geneId, l)
    return m
  }, [layoutData])

  const rectScale =
    layoutData && size.w > 0 ? Math.min(size.w, layoutData.width) / layoutData.width : 1

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
    (
      clientX: number,
      clientY: number,
    ): { leaf: LeafLayout; clientX: number; clientY: number } | null => {
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
        if (radius >= RADIAL.maxR * 0.08 && radius <= RADIAL.maxR + RADIAL.labelMargin) {
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
          if (best && bestDiff > 0.05) best = null
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
        if (best && (bestDiff > RECT.rowH * 0.6 || vx < best.x - RECT.rowH * 3)) best = null
      }
      if (!best) return null
      return { leaf: best, clientX, clientY }
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

  const lastFocus = useRef<{ data: ClusterNode[]; gene: string } | null>(null)
  useEffect(() => {
    if (!selectedGeneId || !layoutData || size.w === 0) return
    if (lastFocus.current?.data === data && lastFocus.current?.gene === selectedGeneId) return
    lastFocus.current = { data, gene: selectedGeneId }
    focusGene(selectedGeneId)
  }, [data, selectedGeneId, layoutData, size, focusGene])

  const focusFamily = useCallback(
    (family: string) => {
      if (!layoutData || size.w === 0) return
      const familyLeaves = layoutData.leaves.filter((l) => l.family === family)
      if (familyLeaves.length === 0) return
      if (!isRadial) {
        const ys = familyLeaves.map((l) => l.y).sort((a, b) => a - b)
        const medianY = ys[Math.floor(ys.length / 2)]
        containerRef.current?.scrollTo({
          top: medianY * rectScale - size.h / 2,
          behavior: "smooth",
        })
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
        // One finger remains after a pinch, so resume panning
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
      if (hit?.leaf.geneId) {
        onSelect(hit.leaf.geneId === selectedGeneId ? null : hit.leaf.geneId)
      } else {
        onSelect(null)
      }
    }
  }

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
      ...figureExportHandlers(buildSvgString),
    }),
    [buildSvgString, layoutData, reset, focusGene, focusFamily],
  )

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
  const flat = layoutData.maxDepth < 1e-6

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
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
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
        <>
          {!flat && (
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                bgcolor: "background.paper",
                pb: 1.5,
              }}
            >
              <svg
                width={layoutData.width * rectScale}
                height={AXIS_H}
                viewBox={`0 0 ${layoutData.width} ${AXIS_H}`}
                style={{ display: "block", margin: "0 auto" }}
              >
                <line
                  x1={layoutData.treeLeft}
                  y1={AXIS_H - 1}
                  x2={layoutData.treeRight}
                  y2={AXIS_H - 1}
                  stroke={edgeColor}
                  strokeWidth={0.5}
                />
                {niceAxisTicks(layoutData.maxDepth).map((t) => {
                  const x =
                    layoutData.treeLeft +
                    (t / layoutData.maxDepth) * (layoutData.treeRight - layoutData.treeLeft)
                  return (
                    <g key={t}>
                      <line
                        x1={x}
                        y1={AXIS_H - 1}
                        x2={x}
                        y2={AXIS_H - 7}
                        stroke={edgeColor}
                        strokeWidth={0.5}
                      />
                      <text
                        x={x}
                        y={AXIS_H - 10}
                        textAnchor="middle"
                        fontSize={isMobile ? 9 : 11}
                        fontFamily={monoFont}
                        fill={edgeColor}
                      >
                        {formatTick(t)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </Box>
          )}
          <svg
            {...svgCommon}
            width={layoutData.width * rectScale}
            height={layoutData.height * rectScale}
            viewBox={`0 0 ${layoutData.width} ${layoutData.height}`}
            style={{ display: "block", margin: "0 auto" }}
          >
            {content}
          </svg>
        </>
      )}
      {hover && (
        <HoverTooltip x={hover.clientX} y={hover.clientY}>
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
        </HoverTooltip>
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
        <text x={leaf.x + 10} y={leaf.y + 4} fontSize={14} fontFamily={monoFont} fill={color}>
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
