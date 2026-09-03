// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box } from "@mui/material"
import HomeHero from "./HomeHero"
import HomeSearch from "./HomeSearch"
import ViewGrid from "./ViewGrid"
import { HOME_MAX_WIDTH } from "./constants"
import { useHomeState } from "./useHomeState"

export default function Home() {
  const { genes, tiles, onSelectGene, onOpenView } = useHomeState()

  return (
    <Box sx={{ minHeight: "100%", display: "flex", justifyContent: "center" }}>
      <Box
        sx={{
          width: "100%",
          maxWidth: HOME_MAX_WIDTH,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: { xs: 4, sm: 5 },
          pt: { xs: 6, sm: 10 },
          pb: 6,
        }}
      >
        <HomeHero />
        <HomeSearch genes={genes} onSelectGene={onSelectGene} />
        <Box sx={{ width: "100%" }}>
          <ViewGrid tiles={tiles} onOpenView={onOpenView} />
        </Box>
      </Box>
    </Box>
  )
}
