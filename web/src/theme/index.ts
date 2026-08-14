// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { createTheme, type Theme, type ThemeOptions } from "@mui/material/styles"
import type {} from "@mui/x-tree-view/themeAugmentation"
import { componentOverrides } from "./components"
import { monoFontFamily, monoFontSize, sansFontFamily } from "./fonts"
import {
  disabledTextFor,
  dividerFor,
  doomColors,
  secondaryTextFor,
  type ThemeMode,
} from "./palette"

export { doomColors, type ThemeMode } from "./palette"
export { monoFontFamily, monoFontSize, sansFontFamily } from "./fonts"
export {
  floatSurfaceBg,
  floatSurfaceBgHover,
  glowFlash,
  glowFlashSx,
  tooltipSurfaceSx,
} from "./surfaces"
export { capBoxSx, capButtonSx, capLineSx } from "./capBox"

declare module "@mui/material/styles" {
  interface Theme {
    custom: { monoFontFamily: string; monoFontSize: string }
  }
  interface ThemeOptions {
    custom?: { monoFontFamily: string; monoFontSize: string }
  }
}

const headingWeight = { fontWeight: 700 }

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
      text: {
        primary: c.fg,
        secondary: secondaryTextFor(mode),
        disabled: disabledTextFor(mode),
      },
      divider: dividerFor(mode),
      action: { active: secondaryTextFor(mode), disabled: dividerFor(mode) },
    },
    typography: {
      fontFamily: sansFontFamily,
      fontSize: 15,
      h1: headingWeight,
      h2: headingWeight,
      h3: headingWeight,
      h4: headingWeight,
      h5: headingWeight,
      h6: headingWeight,
    },
    custom: { monoFontFamily, monoFontSize },
    components: componentOverrides(c, mode),
  }

  return createTheme(options)
}

export const lightTheme = buildTheme("light")
export const darkTheme = buildTheme("dark")
