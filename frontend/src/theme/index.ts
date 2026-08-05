// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { createTheme, type Theme, type ThemeOptions } from "@mui/material/styles"
import type {} from "@mui/x-tree-view/themeAugmentation"
import { componentOverrides } from "./components"
import { monoFontFamily, monoFontSize, sansFontFamily } from "./fonts"
import { doomColors, type ThemeMode } from "./palette"

export { doomColors, type ThemeMode } from "./palette"
export { monoFontFamily, monoFontSize, sansFontFamily } from "./fonts"
export { floatSurfaceBg, floatSurfaceBgHover, tooltipSurfaceSx } from "./surfaces"
export { capBoxSx } from "./capBox"

declare module "@mui/material/styles" {
  interface Theme {
    custom: { monoFontFamily: string; monoFontSize: string }
  }
  interface ThemeOptions {
    custom?: { monoFontFamily: string; monoFontSize: string }
  }
}

function buildTheme(mode: ThemeMode): Theme {
  const c = doomColors[mode]

  const options: ThemeOptions = {
    palette: {
      mode,
      primary: { main: c.blue },
      secondary: { main: c.magenta },
      error: { main: c.red },
      warning: { main: c.yellow },
      success: { main: c.green },
      info: { main: c.teal },
      background: { default: c.bgAlt, paper: c.bg },
      text: { primary: c.fg, secondary: mode === "dark" ? c.base6 : c.base5 },
      divider: mode === "dark" ? c.base4 : c.base3,
    },
    typography: {
      fontFamily: sansFontFamily,
      fontSize: 15,
    },
    custom: { monoFontFamily, monoFontSize },
    components: componentOverrides(c, mode),
  }

  return createTheme(options)
}

export const lightTheme = buildTheme("light")
export const darkTheme = buildTheme("dark")
