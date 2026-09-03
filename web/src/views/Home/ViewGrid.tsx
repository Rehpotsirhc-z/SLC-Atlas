// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, useTheme } from "@mui/material"
import { doomColors } from "@/theme"
import { VIEW_ACCENT, TILE_MIN_WIDTH } from "./constants"
import { VIEW_ICONS } from "./viewIcons"
import ViewTile from "./ViewTile"
import type { HomeTile } from "./useHomeState"

interface Props {
  tiles: HomeTile[]
  onOpenView: (path: string) => void
}

export default function ViewGrid({ tiles, onOpenView }: Props) {
  const { palette } = useTheme()
  const colors = doomColors[palette.mode]

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "1fr",
          sm: `repeat(auto-fill, minmax(${TILE_MIN_WIDTH}px, 1fr))`,
        },
      }}
    >
      {tiles.map((route) => (
        <ViewTile
          key={route.path}
          label={route.label}
          description={route.description}
          accent={colors[VIEW_ACCENT[route.path]]}
          Icon={VIEW_ICONS[route.path]}
          onClick={() => onOpenView(route.path)}
        />
      ))}
    </Box>
  )
}
