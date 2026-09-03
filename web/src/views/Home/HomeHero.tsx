// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Typography } from "@mui/material"
import { atlas } from "@/config/atlas"
import { monoFontFamily } from "@/theme"

export default function HomeHero() {
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography
        component="h1"
        sx={{
          color: "primary.main",
          fontFamily: monoFontFamily,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          fontSize: { xs: "2.25rem", sm: "3rem" },
        }}
      >
        {atlas.name}
      </Typography>
      {atlas.description && (
        <Typography
          variant="h6"
          color="text.secondary"
          sx={{ mt: 1.5, fontWeight: 400, maxWidth: 620, mx: "auto" }}
        >
          {atlas.description}
        </Typography>
      )}
    </Box>
  )
}
