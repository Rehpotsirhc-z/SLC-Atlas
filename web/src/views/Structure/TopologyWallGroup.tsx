// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { Box, Typography } from "@mui/material"
import { styled } from "@mui/material/styles"
import { WALL } from "./constants"
import TopologyGlyph, { type WallInk } from "./TopologyGlyph"
import type { WallGene, WallGroup } from "./topologyWall"

interface Props {
  group: WallGroup
  ink: WallInk
  familyFilter: string | null
}

const GlyphButton = styled("button")(({ theme }) => ({
  all: "unset",
  boxSizing: "border-box",
  cursor: "pointer",
  padding: `${WALL.cellPadTop}px ${WALL.cellPadX}px ${WALL.cellPadBottom}px`,
  borderRadius: theme.shape.borderRadius,
  display: "block",
  flexShrink: 0,
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}` },
}))

const WallGenes = memo(function WallGenes({ genes, ink }: { genes: WallGene[]; ink: WallInk }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 8px",
        pt: 1.5,
        mx: `${-WALL.cellPadX}px`,
      }}
    >
      {genes.map((gene) => (
        <GlyphButton
          key={gene.geneId}
          type="button"
          data-gene-id={gene.geneId}
          data-family={gene.family}
        >
          <TopologyGlyph gene={gene} ink={ink} />
        </GlyphButton>
      ))}
    </Box>
  )
})

const TopologyWallGroup = memo(function TopologyWallGroup({ group, ink, familyFilter }: Props) {
  const { nTransmembrane, genes } = group
  const count = familyFilter
    ? genes.reduce((n, g) => (g.family === familyFilter ? n + 1 : n), 0)
    : genes.length
  return (
    <Box
      component="section"
      style={{
        display: count === 0 ? "none" : undefined,
        // Offscreen groups skip layout and paint, which is most of a filter toggle's cost
        contentVisibility: "auto",
        containIntrinsicSize: "auto 300px",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "baseline",
          columnGap: 1,
          rowGap: 0.75,
          pb: 0.75,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          variant="subtitle2"
          color="secondary"
          fontWeight={700}
          fontFamily={(t) => t.custom.monoFontFamily}
        >
          {nTransmembrane}
        </Typography>
        <Typography variant="overline" color="secondary" lineHeight={1.6}>
          transmembrane {nTransmembrane === 1 ? "helix" : "helices"}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count === 1 ? "1 gene" : `${count} genes`}
        </Typography>
      </Box>

      <WallGenes genes={genes} ink={ink} />
    </Box>
  )
})

export default TopologyWallGroup
