// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Link as RouterLink, useLocation } from "react-router-dom"
import HomeIcon from "@mui/icons-material/Home"
import { Box, Button, Typography, useTheme } from "@mui/material"
import { capBoxSx, capButtonSx } from "@/theme"

export default function NotFound() {
  const { pathname } = useLocation()
  const theme = useTheme()

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        textAlign: "center",
      }}
    >
      <Typography variant="h1" color="primary" sx={{ lineHeight: 1 }}>
        404
      </Typography>
      <Typography variant="h5">Page not found</Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontFamily: theme.custom.monoFontFamily, wordBreak: "break-all" }}
      >
        {pathname}
      </Typography>
      <Button
        component={RouterLink}
        to="/"
        size="small"
        variant="outlined"
        startIcon={<HomeIcon />}
        sx={{
          mt: 2,
          gap: "6px",
          ...capButtonSx,
          "& .MuiButton-startIcon": { margin: 0 },
        }}
      >
        <Box component="span" sx={capBoxSx}>
          Go home
        </Box>
      </Button>
    </Box>
  )
}
