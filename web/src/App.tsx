// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route, Navigate } from "react-router-dom"
import { AppBar, Box, Toolbar, Typography, useMediaQuery, useTheme } from "@mui/material"
import { AppNavMenu, AppNavTabs } from "./components/AppNav"
import ThemeToggle from "./components/ThemeToggle"
import GeneInfoPopup from "./components/GeneInfoPopup"
import { routes } from "./routes"
import { atlas } from "./config/atlas"

export default function App() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{
          pt: "env(safe-area-inset-top)",
          pl: "env(safe-area-inset-left)",
          pr: "env(safe-area-inset-right)",
        }}
      >
        <Toolbar variant="dense">
          {isMobile && <AppNavMenu />}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 2, whiteSpace: "nowrap" }}>
            {atlas.shortName}
          </Typography>
          {!isMobile && <AppNavTabs />}
          <Box sx={{ flexGrow: 1 }} />
          <ThemeToggle />
        </Toolbar>
      </AppBar>
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          pl: "max(16px, env(safe-area-inset-left))",
          pr: "max(16px, env(safe-area-inset-right))",
          pb: "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/genes" replace />} />
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Routes>
      </Box>
      <GeneInfoPopup />
    </Box>
  )
}
