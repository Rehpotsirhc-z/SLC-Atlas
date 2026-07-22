// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch, RefObject, SetStateAction } from "react"
import type { ClusterNode } from "@/types/clustering"
import type { ElementSize } from "@/utils/useElementSize"
import type { LeafLayout, TreeLayout } from "./phyloLayout"
import type { Transform } from "./usePhyloTransform"

interface Options {
  data: ClusterNode[]
  layoutData: TreeLayout | null
  leafByGene: Map<string, LeafLayout>
  size: ElementSize
  isRadial: boolean
  rectScale: number
  selectedGeneId: string | null
  setTransform: Dispatch<SetStateAction<Transform>>
  containerRef: RefObject<HTMLDivElement | null>
}

export function usePhyloFocus({
  data,
  layoutData,
  leafByGene,
  size,
  isRadial,
  rectScale,
  selectedGeneId,
  setTransform,
  containerRef,
}: Options) {
  const scrollToY = useCallback(
    (y: number) => containerRef.current?.scrollTo({ top: y - size.h / 2, behavior: "smooth" }),
    [containerRef, size.h],
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
        scrollToY(leaf.y * rectScale)
      }
    },
    [layoutData, size, isRadial, leafByGene, rectScale, setTransform, scrollToY],
  )

  const focusFamily = useCallback(
    (family: string) => {
      if (!layoutData || size.w === 0 || isRadial) return
      const ys = layoutData.leaves
        .filter((l) => l.family === family)
        .map((l) => l.y)
        .sort((a, b) => a - b)
      if (!ys.length) return
      scrollToY(ys[Math.floor(ys.length / 2)] * rectScale)
    },
    [layoutData, size.w, isRadial, rectScale, scrollToY],
  )

  // Re-arm only when the tree or the selection actually changes, not on every re-render
  const lastFocus = useRef<{ data: ClusterNode[]; gene: string } | null>(null)
  useEffect(() => {
    if (!selectedGeneId || !layoutData || size.w === 0) return
    if (lastFocus.current?.data === data && lastFocus.current?.gene === selectedGeneId) return
    lastFocus.current = { data, gene: selectedGeneId }
    focusGene(selectedGeneId)
  }, [data, selectedGeneId, layoutData, size, focusGene])

  return { focusGene, focusFamily }
}
