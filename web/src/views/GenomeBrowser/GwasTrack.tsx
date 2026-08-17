// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useEffect, type RefObject } from "react"
import { type VariantBlock } from "@/api/bbi"
import type { GwasStudy } from "@/types/browser"
import GwasLane from "./GwasLane"
import { GWAS_BLOCK_MARGIN_SPANS } from "./constants"
import type { BrowserView } from "./useBrowserView"
import { useCoverageBlock } from "./useCoverageData"
import { useVisibleGwas } from "./useFeatureData"
import type { LaneVisibility } from "./useLaneVisibility"

interface Props {
  study: GwasStudy
  view: BrowserView
  chrom: string
  chromSize: number
  covered: boolean
  width: number
  gutter: number
  grid: boolean
  showSignificance: boolean
  isVisible: (key: string) => boolean
  watch?: LaneVisibility["watch"]
  blockRef: RefObject<VariantBlock | null>
}

export default function GwasTrack({
  study,
  view,
  chrom,
  chromSize,
  covered,
  width,
  gutter,
  grid,
  showSignificance,
  isVisible,
  watch,
  blockRef,
}: Props) {
  const block = useCoverageBlock(view.view, chrom || undefined, chromSize, GWAS_BLOCK_MARGIN_SPANS)
  // Select the pyramid level from the cached block to avoid refetching during each zoom step
  const blockStep = block ? (block.end - block.start) / Math.max(width, 1) : 0
  const gwas = useVisibleGwas(chrom || undefined, block, blockStep, study, isVisible)

  useEffect(() => {
    blockRef.current = gwas.block
  }, [gwas.block, blockRef])

  return (
    <GwasLane
      study={study}
      block={gwas.block}
      chrom={chrom}
      covered={covered}
      partial={gwas.bin > 0}
      loading={gwas.loading}
      width={width}
      gutter={gutter}
      grid={grid}
      showSignificance={showSignificance}
      subscribe={view.subscribe}
      liveView={view.liveView}
      moving={view.moving}
      watch={watch}
    />
  )
}
