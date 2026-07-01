// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { createTheme, type Theme, type ThemeOptions } from "@mui/material/styles"
import type {} from "@mui/x-tree-view/themeAugmentation"

export type ThemeMode = "light" | "dark"

declare module "@mui/material/styles" {
  interface Theme {
    custom: { monoFontFamily: string; monoFontSize: string }
  }
  interface ThemeOptions {
    custom?: { monoFontFamily: string; monoFontSize: string }
  }
}

// Doom One and its official light sibling Doom One Light
// https://github.com/doomemacs/themes/tree/master/themes
export const doomColors = {
  dark: {
    bg: "#282c34",
    bgAlt: "#21242b",
    base0: "#1B2229",
    base1: "#1c1f24",
    base2: "#202328",
    base3: "#23272e",
    base4: "#3f444a",
    base5: "#5B6268",
    base6: "#73797e",
    base7: "#9ca0a4",
    base8: "#DFDFDF",
    fg: "#bbc2cf",
    fgAlt: "#5B6268",
    grey: "#3f444a",
    red: "#ff6c6b",
    orange: "#da8548",
    green: "#98be65",
    teal: "#4db5bd",
    yellow: "#ECBE7B",
    blue: "#51afef",
    darkBlue: "#2257A0",
    magenta: "#c678dd",
    violet: "#a9a1e1",
    cyan: "#46D9FF",
    darkCyan: "#5699AF",
  },
  light: {
    bg: "#fafafa",
    bgAlt: "#f0f0f0",
    base0: "#f0f0f0",
    base1: "#e7e7e7",
    base2: "#dfdfdf",
    base3: "#c6c7c7",
    base4: "#9ca0a4",
    base5: "#383a42",
    base6: "#202328",
    base7: "#1c1f24",
    base8: "#1b2229",
    fg: "#383a42",
    fgAlt: "#c6c7c7",
    grey: "#9ca0a4",
    red: "#e45649",
    orange: "#da8548",
    green: "#50a14f",
    teal: "#4db5bd",
    yellow: "#986801",
    blue: "#4078f2",
    darkBlue: "#a0bcf8",
    magenta: "#a626a4",
    violet: "#b751b6",
    cyan: "#0184bc",
    darkCyan: "#005478",
  },
} as const

export const monoFontFamily = '"Source Code Pro", monospace'
// Fixed size for monospace data (gene IDs, positions, sequences, etc.) so it
// doesn't grow when typography.fontSize is tuned for the Source Sans 3 UI text.
export const monoFontSize = "0.8125rem"

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
      fontFamily: '"Source Sans 3", sans-serif',
      fontSize: 15,
    },
    custom: { monoFontFamily, monoFontSize },
    components: {
      MuiTab: {
        styleOverrides: {
          root: { minHeight: 48, textTransform: "none" },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: mode === "dark" ? c.base4 : c.base3 },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: "uppercase",
            fontWeight: 600,
            fontSize: "0.8rem",
            letterSpacing: "0.06em",
            padding: "6px",
            color: mode === "dark" ? c.base6 : c.base5,
            borderColor: mode === "dark" ? c.base4 : c.base3,
            "&.Mui-selected": {
              color: c.magenta,
              backgroundColor: `${c.magenta}25`,
              borderColor: c.magenta,
            },
            "&:hover": { backgroundColor: `${c.base4}40` },
            "&.Mui-selected:hover": { backgroundColor: `${c.magenta}45` },
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          grouped: {
            "&.Mui-selected + &": { borderLeftColor: c.magenta },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: c.bgAlt,
            backgroundImage: "none",
            border: `1px solid ${mode === "dark" ? c.base4 : c.base3}`,
            boxShadow:
              mode === "dark" ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.12)",
          },
          list: { padding: 0 },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: { fontFamily: monoFontFamily },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: monoFontFamily,
            fontSize: "0.8rem",
            fontWeight: 500,
            letterSpacing: "0.02em",
            lineHeight: 1.4,
            color: mode === "dark" ? c.base7 : c.base5,
            minHeight: "unset",
            paddingTop: "11px",
            paddingBottom: "9px",
            paddingLeft: "10px",
            paddingRight: "10px",
            display: "flex",
            alignItems: "center",
            borderBottom: `1px solid ${mode === "dark" ? c.base4 : c.base3}`,
            "&:last-child": { borderBottom: "none" },
            "&:hover": { backgroundColor: `${c.base4}40`, color: c.fg },
            "&.Mui-selected": {
              backgroundColor: `${c.magenta}20`,
              color: c.magenta,
              "&:hover": { backgroundColor: `${c.magenta}30` },
            },
          },
        },
      },
      MuiTreeItem: {
        styleOverrides: {
          content: { borderRadius: 0 },
          iconContainer: { "& svg": { color: c.green } },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          "*": {
            scrollbarWidth: "thin",
            scrollbarColor: `${c.base4} transparent`,
          },
          "*::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "*::-webkit-scrollbar-track": {
            backgroundColor: "transparent",
          },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: c.base4,
            borderRadius: 8,
          },
          "*::-webkit-scrollbar-thumb:hover": {
            backgroundColor: c.base5,
          },
        },
      },
    },
  }

  return createTheme(options)
}

export const lightTheme = buildTheme("light")
export const darkTheme = buildTheme("dark")
