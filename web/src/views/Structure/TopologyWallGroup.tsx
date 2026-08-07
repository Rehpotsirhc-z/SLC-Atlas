// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { memo } from "react"
import { Box, ButtonBase, Typography } from "@mui/material"
import { WALL } from "./constants"
import TopologyGlyph, { type WallInk } from "./TopologyGlyph"
import type { WallGroup } from "./topologyWall"

interface Props {
  group: WallGroup
  ink: WallInk
}

const TopologyWallGroup = memo(function TopologyWallGroup({ group, ink }: Props) {
  const { nTransmembrane, genes } = group
  return (
    <Box component="section">
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
          {genes.length === 1 ? "1 gene" : `${genes.length} genes`}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", pt: 1.5 }}>
        {genes.map((gene) => (
          <ButtonBase
            key={gene.geneId}
            data-gene-id={gene.geneId}
            focusRipple
            sx={{
              padding: `${WALL.cellPadTop}px ${WALL.cellPadX}px ${WALL.cellPadBottom}px`,
              borderRadius: 1,
              display: "block",
              // The glyph is drawn to a residue scale, so it must never be squeezed to fit a row
              flexShrink: 0,
              "&:hover": { bgcolor: "action.hover" },
              "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main" },
            }}
          >
            <TopologyGlyph gene={gene} ink={ink} />
          </ButtonBase>
        ))}
      </Box>
    </Box>
  )
})

export default TopologyWallGroup
