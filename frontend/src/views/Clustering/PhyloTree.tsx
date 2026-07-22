// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react"
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material"
import { figureExportHandlers } from "@/utils/exportFigure"
import { useElementSize } from "@/utils/useElementSize"
import type { ClusterNode } from "@/types/clustering"
import type { Gene } from "@/types/gene"
import PhyloAxis from "./PhyloAxis"
import PhyloTooltip from "./PhyloTooltip"
import { Highlight, LeafLabel } from "./PhyloLeaf"
import { isFlat, type Layout, type LeafLayout } from "./phyloLayout"
import { usePhyloFocus } from "./usePhyloFocus"
import { usePhyloHitTest } from "./usePhyloHitTest"
import { usePhyloLayout } from "./usePhyloLayout"
import { usePhyloTransform } from "./usePhyloTransform"

export type { Layout }

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

// Deliberately outside the palette so the tree keeps its own muted greys in both themes
const EDGE_COLOR = { dark: "#5B6268", light: "#9ca0a4" }
const DIM_COLOR = { dark: "#4a4f55", light: "#d0d0d0" }

interface HoverState {
  leaf: LeafLayout
  clientX: number
  clientY: number
}

const PhyloTree = forwardRef<PhyloTreeHandle, PhyloTreeProps>(function PhyloTree(
  { data, layout, familyFilter, selectedGeneId, onSelect, geneById },
  ref,
) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const mode = theme.palette.mode
  const monoFont = theme.custom.monoFontFamily
  const edgeColor = EDGE_COLOR[mode]
  const isRadial = layout === "radial"

  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const svgRef = useRef<SVGSVGElement>(null)
  const treeGroupRef = useRef<SVGGElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)

  const { layoutData, leafByGene, rectScale } = usePhyloLayout(data, layout, size.w)

  const view = usePhyloTransform({ isRadial, layoutData, size, svgRef, containerRef })
  const { transform } = view

  const hitTest = usePhyloHitTest({ layoutData, isRadial, transform, rectScale, svgRef })

  const { focusGene, focusFamily } = usePhyloFocus({
    data,
    layoutData,
    leafByGene,
    size,
    isRadial,
    rectScale,
    selectedGeneId,
    setTransform: view.setTransform,
    containerRef,
  })

  const buildSvgString = () => {
    if (!treeGroupRef.current || !layoutData) return null
    const clone = treeGroupRef.current.cloneNode(true) as SVGGElement
    clone.removeAttribute("transform")
    const { width: w, height: h } = layoutData
    const bg = theme.palette.background.paper
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${clone.outerHTML}</svg>`
  }
  const buildSvgRef = useRef(buildSvgString)
  buildSvgRef.current = buildSvgString

  useImperativeHandle(
    ref,
    () => ({
      resetView: view.reset,
      focusGene,
      focusFamily,
      ...figureExportHandlers(() => buildSvgRef.current()),
    }),
    [view.reset, focusGene, focusFamily],
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
            dimColor={DIM_COLOR[mode]}
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
    onPointerDown: view.beginGesture,
    onPointerMove: (e: React.PointerEvent) => {
      const phase = view.moveGesture(e)
      if (phase === "pinch") setHover(null)
      else if (phase === "idle") {
        const leaf = hitTest(e.clientX, e.clientY)
        setHover(leaf ? { leaf, clientX: e.clientX, clientY: e.clientY } : null)
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!view.endGesture(e)) return
      const leaf = hitTest(e.clientX, e.clientY)
      onSelect(leaf?.geneId && leaf.geneId !== selectedGeneId ? leaf.geneId : null)
    },
    onDoubleClick: view.reset,
    onPointerLeave: () => {
      setHover(null)
      view.cancelGesture()
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
            cursor: view.dragging ? "grabbing" : "grab",
            touchAction: "none",
          }}
        >
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {content}
          </g>
        </svg>
      ) : (
        <>
          {!isFlat(layoutData.maxDepth) && (
            <PhyloAxis
              layoutData={layoutData}
              scale={rectScale}
              color={edgeColor}
              monoFont={monoFont}
              compact={isMobile}
            />
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
        <PhyloTooltip
          leaf={hover.leaf}
          gene={hoverGene}
          x={hover.clientX}
          y={hover.clientY}
          monoFont={monoFont}
        />
      )}
    </Box>
  )
})

export default PhyloTree
