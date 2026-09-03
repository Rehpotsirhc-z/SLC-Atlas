// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route, Link as RouterLink } from "react-router-dom"
import { AppBar, Box, Toolbar, Typography, useMediaQuery, useTheme } from "@mui/material"
import { AppNavMenu, AppNavTabs } from "./components/AppNav"
import ThemeToggle from "./components/ThemeToggle"
import AppInfoButton from "./components/AppInfoButton"
import GeneInfoPopup from "./components/GeneInfoPopup"
import AboutDataPopup from "./components/AboutDataPopup"
import ShareUrlSync from "./components/ShareUrlSync"
import { routes } from "./routes"
import { atlas } from "./config/atlas"
import Home from "./views/Home"
import NotFound from "./views/NotFound"

export default function App() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <ShareUrlSync />
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
          <Typography
            component={RouterLink}
            to="/"
            variant="subtitle1"
            fontWeight={700}
            sx={{
              mr: 2,
              whiteSpace: "nowrap",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {atlas.shortName}
          </Typography>
          {!isMobile && <AppNavTabs />}
          {isMobile && <Box sx={{ flexGrow: 1 }} />}
          <AppInfoButton />
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
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
      <GeneInfoPopup />
      <AboutDataPopup />
    </Box>
  )
}
