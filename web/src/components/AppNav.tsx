// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from "react"
import { matchPath, useLocation, useNavigate } from "react-router-dom"
import MenuIcon from "@mui/icons-material/Menu"
import { IconButton, Menu, MenuItem, Tab, type TabProps, Tabs, Tooltip } from "@mui/material"
import { useCapabilities } from "@/api/hooks/useCapabilities"
import { ROUTES, type RouteMeta } from "@/config/routes"

function useVisibleRoutes() {
  const { data } = useCapabilities()
  return useMemo(
    () => ROUTES.filter((route) => !route.capability || data?.[route.capability] === true),
    [data],
  )
}

function useActiveRoute(visible: RouteMeta[]) {
  const { pathname } = useLocation()
  return visible.findIndex((r) => matchPath({ path: r.path, end: false }, pathname) !== null)
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

function NavTab({ description, ...tabProps }: TabProps & { description: string }) {
  return (
    <Tooltip title={description} placement="bottom" enterDelay={300}>
      <Tab {...tabProps} />
    </Tooltip>
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
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{ flex: 1, minWidth: 0 }}
    >
      {visible.map((r) => (
        <NavTab key={r.path} label={r.label} description={r.description} />
      ))}
    </Tabs>
  )
}
