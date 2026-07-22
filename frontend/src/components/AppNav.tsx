// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import MenuIcon from "@mui/icons-material/Menu"
import { IconButton, Menu, MenuItem, Tab, Tabs } from "@mui/material"
import { routes } from "@/routes"

function useActiveRoute() {
  const { pathname } = useLocation()
  return routes.findIndex((r) => pathname.startsWith(r.path))
}

export function AppNavMenu() {
  const navigate = useNavigate()
  const activeIndex = useActiveRoute()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ mr: 1 }}>
        <MenuIcon />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {routes.map((r, i) => (
          <MenuItem
            key={r.path}
            selected={activeIndex === i}
            onClick={() => {
              navigate(r.path)
              setMenuAnchor(null)
            }}
          >
            {r.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export function AppNavTabs() {
  const navigate = useNavigate()
  const activeIndex = useActiveRoute()

  return (
    <Tabs
      value={activeIndex === -1 ? false : activeIndex}
      onChange={(_, i: number) => navigate(routes[i].path)}
      textColor="primary"
      indicatorColor="primary"
    >
      {routes.map((r) => (
        <Tab key={r.path} label={r.label} />
      ))}
    </Tabs>
  )
}
