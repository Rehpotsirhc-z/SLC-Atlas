// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from "react"
import type { MouseEvent } from "react"
import { Stack, Typography, useTheme } from "@mui/material"
import HoverTooltip from "@/components/HoverTooltip"
import { doomColors } from "@/theme"
import TopologyWallGroup from "./TopologyWallGroup"
import type { WallInk } from "./TopologyGlyph"
import type { Wall, WallGene } from "./topologyWall"

interface Props {
  wall: Wall
  familyFilter: string | null
  hidden: boolean
  onSelectGene: (geneId: string) => void
}

interface Hovered {
  gene: WallGene
  x: number
  y: number
}

function geneIdAt(target: EventTarget): string | null {
  if (!(target instanceof Element)) return null
  return target.closest("[data-gene-id]")?.getAttribute("data-gene-id") ?? null
}

export default function TopologyWall({ wall, familyFilter, hidden, onSelectGene }: Props) {
  const { palette, custom } = useTheme()
  const [hovered, setHovered] = useState<Hovered | null>(null)

  useEffect(() => {
    if (hidden) setHovered(null)
  }, [hidden])

  const ink = useMemo<WallInk>(() => {
    const c = doomColors[palette.mode]
    return {
      band: palette.mode === "dark" ? c.base3 : c.bgAlt,
      chain: palette.mode === "dark" ? c.base4 : c.base3,
      label: palette.text.secondary,
    }
  }, [palette])

  const geneById = useMemo(
    () => new Map(wall.groups.flatMap((g) => g.genes).map((gene) => [gene.geneId, gene])),
    [wall],
  )

  const handleMove = useCallback(
    (e: MouseEvent) => {
      const geneId = geneIdAt(e.target)
      const gene = geneId ? geneById.get(geneId) : null
      if (!gene) {
        setHovered((prev) => (prev ? null : prev))
        return
      }
      setHovered({ gene, x: e.clientX, y: e.clientY })
    },
    [geneById],
  )

  const handleLeave = useCallback(() => setHovered((prev) => (prev ? null : prev)), [])

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const geneId = geneIdAt(e.target)
      if (geneId) onSelectGene(geneId)
    },
    [onSelectGene],
  )

  return (
    <>
      {familyFilter && (
        <style>
          {`[data-topology-wall] [data-family]:not([data-family="${CSS.escape(familyFilter)}"]) { display: none }`}
        </style>
      )}
      <Stack
        spacing={3}
        useFlexGap
        data-topology-wall=""
        sx={{ display: hidden ? "none" : undefined }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={handleClick}
      >
        {wall.groups.map((group) => (
          <TopologyWallGroup
            key={group.nTransmembrane}
            group={group}
            ink={ink}
            familyFilter={familyFilter}
          />
        ))}
      </Stack>

      {!hidden && hovered && (
        <HoverTooltip x={hovered.x} y={hovered.y}>
          <Typography
            variant="caption"
            component="div"
            sx={{ fontFamily: custom.monoFontFamily, fontWeight: 600, fontSize: 13 }}
          >
            {hovered.gene.symbol}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            sx={{ fontSize: 13 }}
          >
            {hovered.gene.familyName}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            color="text.secondary"
            sx={{ fontSize: 13 }}
          >
            {hovered.gene.nExperimental === 0
              ? "Predicted model only"
              : `${hovered.gene.nExperimental} experimental ${
                  hovered.gene.nExperimental === 1 ? "structure" : "structures"
                }, best ${hovered.gene.bestPdbId?.toUpperCase()}`}
          </Typography>
          <Typography variant="caption" component="div" sx={{ fontSize: 13 }}>
            {hovered.gene.length} residues, {hovered.gene.nTransmembrane} crossing the membrane
          </Typography>
        </HoverTooltip>
      )}
    </>
  )
}
