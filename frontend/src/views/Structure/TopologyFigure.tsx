// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, type RefObject } from "react"
import { Box } from "@mui/material"
import TopologyDiagram from "./TopologyDiagram"
import TopologyLegend from "./TopologyLegend"
import TopologyTooltip from "./TopologyTooltip"
import type { TopologyTarget } from "./topologyTargets"
import type { useTopologyState } from "./useTopologyState"

interface Props {
  length: number
  plddt: number[] | null
  topology: ReturnType<typeof useTopologyState>
  svgRef?: RefObject<SVGSVGElement | null>
}

export default function TopologyFigure({ length, plddt, topology, svgRef }: Props) {
  const { layout, hover, track, clear, highlight, select } = topology
  // Where the cursor is concerns the tooltip alone, so it stops here rather than reaching
  // the diagram beside it or the viewer the hovered target is shared with
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
      <TopologyDiagram
        layout={layout}
        length={length}
        plddt={plddt}
        highlight={highlight}
        onHover={onHover}
        onLeave={onLeave}
        onSelect={select}
        svgRef={svgRef}
      />

      <TopologyLegend layout={layout} />

      {hover && point && <TopologyTooltip hover={hover} point={point} layout={layout} />}
    </Box>
  )
}
