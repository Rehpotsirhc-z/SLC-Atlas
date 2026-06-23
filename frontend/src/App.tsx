// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import MenuIcon from "@mui/icons-material/Menu"
import {
  AppBar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import ThemeToggle from "./components/ThemeToggle"
import GeneAnnotation from "./views/GeneAnnotation"
import Clustering from "./views/Clustering"
import Conservation from "./views/Conservation"
import GenomeBrowser from "./views/GenomeBrowser"
import Expression from "./views/Expression"
import Structure from "./views/Structure"
import PetScan from "./views/PetScan"

const navigation = [
  { path: "/genes", label: "Genes" },
  { path: "/clustering", label: "Clustering" },
  { path: "/conservation", label: "Conservation" },
  { path: "/browser", label: "Genome Browser" },
  { path: "/expression", label: "Expression" },
  { path: "/structure", label: "Structure" },
  { path: "/pet", label: "PET-SCAN" },
]

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tabValue = navigation.findIndex((n) => pathname.startsWith(n.path))
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          {isMobile && (
            <>
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
                {navigation.map((n, i) => (
                  <MenuItem
                    key={n.path}
                    selected={tabValue === i}
                    onClick={() => {
                      navigate(n.path)
                      setMenuAnchor(null)
                    }}
                  >
                    {n.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 2, whiteSpace: "nowrap" }}>
            SLC Atlas
          </Typography>
          {!isMobile && (
            <Tabs
              value={tabValue === -1 ? false : tabValue}
              onChange={(_, i: number) => navigate(navigation[i].path)}
              textColor="primary"
              indicatorColor="primary"
            >
              {navigation.map((n) => (
                <Tab key={n.path} label={n.label} />
              ))}
            </Tabs>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <ThemeToggle />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/genes" replace />} />
          <Route path="/genes" element={<GeneAnnotation />} />
          <Route path="/clustering" element={<Clustering />} />
          <Route path="/conservation" element={<Conservation />} />
          <Route path="/browser" element={<GenomeBrowser />} />
          <Route path="/expression" element={<Expression />} />
          <Route path="/structure" element={<Structure />} />
          <Route path="/pet" element={<PetScan />} />
        </Routes>
      </Box>
    </Box>
  )
}
