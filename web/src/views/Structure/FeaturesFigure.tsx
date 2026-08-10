// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, type RefObject } from "react"
import { Box } from "@mui/material"
import type { ChainModel } from "./chainModel"
import FeaturesDiagram from "./FeaturesDiagram"
import type { FeaturesLayout } from "./featuresLayout"
import TopologyLegend from "./TopologyLegend"
import TopologyTooltip from "./TopologyTooltip"
import type { TopologyTarget } from "./topologyTargets"
import type { useTopologyState } from "./useTopologyState"

interface Props {
  model: ChainModel
  layout: FeaturesLayout
  plddt: number[] | null
  topology: ReturnType<typeof useTopologyState>
  svgRef?: RefObject<SVGSVGElement | null>
}

export default function FeaturesFigure({ model, layout, plddt, topology, svgRef }: Props) {
  const { hover, track, clear, highlight, select } = topology
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)

  const onHover = useCallback(
    (event: React.MouseEvent, target: TopologyTarget) => {
      setPoint({ x: event.clientX, y: event.clientY })
      track(target)
    },
    [track],
  )

  const onLeave = useCallback(() => {
    setPoint(null)
    clear()
  }, [clear])

  return (
    <Box>
      <FeaturesDiagram
        layout={layout}
        length={model.length}
        plddt={plddt}
        highlight={highlight}
        onHover={onHover}
        onLeave={onLeave}
        onSelect={select}
        svgRef={svgRef}
      />

      <TopologyLegend
        model={model}
        hasConfidence={layout.confidence.length > 0}
        variant="sequence"
      />

      {hover && point && <TopologyTooltip hover={hover} point={point} model={model} />}
    </Box>
  )
}
