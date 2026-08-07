// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import MenuIcon from "@mui/icons-material/Menu"
import { IconButton, Menu, MenuItem, Tab, Tabs } from "@mui/material"
import { useCapabilities } from "@/api/hooks/useCapabilities"
import { ROUTES, type RouteMeta } from "@/config/routes"

function useVisibleRoutes() {
  const { data } = useCapabilities()
  return useMemo(
    () => ROUTES.filter((r) => !r.capability || data?.[r.capability] !== false),
    [data],
  )
}

function useActiveRoute(visible: RouteMeta[]) {
  const { pathname } = useLocation()
  return visible.findIndex((r) => pathname.startsWith(r.path))
}

export function AppNavMenu() {
  const navigate = useNavigate()
  const visible = useVisibleRoutes()
  const activeIndex = useActiveRoute(visible)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ mr: 1 }}>
        <MenuIcon />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {visible.map((r, i) => (
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
  const visible = useVisibleRoutes()
  const activeIndex = useActiveRoute(visible)

  return (
    <Tabs
      value={activeIndex === -1 ? false : activeIndex}
      onChange={(_, i: number) => navigate(visible[i].path)}
      textColor="primary"
      indicatorColor="primary"
    >
      {visible.map((r) => (
        <Tab key={r.path} label={r.label} />
      ))}
    </Tabs>
  )
}
