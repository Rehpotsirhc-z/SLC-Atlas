// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom"
import { AppBar, Toolbar, Tabs, Tab, Box, Typography } from "@mui/material"
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense">
          <Typography variant="subtitle1" fontWeight={700} sx={{ mr: 3, whiteSpace: "nowrap" }}>
            SLC Atlas
          </Typography>
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
