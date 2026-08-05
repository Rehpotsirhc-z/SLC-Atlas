// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, type RefObject } from "react"
import { Box, Typography } from "@mui/material"
import SnakeDiagram from "./SnakeDiagram"
import TopologyLegend from "./TopologyLegend"
import TopologyTooltip from "./TopologyTooltip"
import type { ChainModel } from "./chainModel"
import type { SnakeLayout } from "./snakeLayout"
import type { TopologyTarget } from "./topologyTargets"
import type { useTopologyState } from "./useTopologyState"

interface Props {
  model: ChainModel
  layout: SnakeLayout
  topology: ReturnType<typeof useTopologyState>
  svgRef?: RefObject<SVGSVGElement | null>
}

export default function SnakeFigure({ model, layout, topology, svgRef }: Props) {
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

  if (!layout.elements.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        UniProt places no part of this protein in the membrane, so there is no chain to snake.
      </Typography>
    )
  }

  return (
    <Box>
      <SnakeDiagram
        layout={layout}
        highlight={highlight}
        onHover={onHover}
        onLeave={onLeave}
        onSelect={select}
        svgRef={svgRef}
      />

      <TopologyLegend model={model} hasConfidence={layout.hasConfidence} unresolvedAs="ring" />

      {hover && point && <TopologyTooltip hover={hover} point={point} model={model} />}
    </Box>
  )
}
