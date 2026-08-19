// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { ThemeOptions } from "@mui/material/styles"
import { capBoxSx } from "./capBox"
import { dividerFor, secondaryTextFor, type DoomColors, type ThemeMode } from "./palette"
import { monoFontFamily } from "./fonts"

export function componentOverrides(c: DoomColors, mode: ThemeMode): ThemeOptions["components"] {
  const divider = dividerFor(mode)
  const dimText = secondaryTextFor(mode)
  return {
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
        root: { borderColor: divider },
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
          color: dimText,
          borderColor: divider,
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
          border: `1px solid ${divider}`,
          boxShadow: mode === "dark" ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.12)",
        },
        list: { padding: 0 },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          fontSize: "0.8rem",
          "&.MuiInputBase-adornedStart": { paddingLeft: "9px" },
          "& .MuiOutlinedInput-notchedOutline": { borderColor: divider },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: c.base5 },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: divider,
            borderWidth: 1,
          },
          "&&:has([aria-expanded='true']) .MuiOutlinedInput-notchedOutline, &&:has(:focus-visible) .MuiOutlinedInput-notchedOutline":
            {
              borderColor: c.magenta,
              borderWidth: 1,
            },
        },
        select: {
          fontFamily: monoFontFamily,
          minHeight: "unset",
          paddingTop: "7px",
          paddingBottom: "7px",
        },
        icon: { color: dimText },
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
          color: mode === "dark" ? c.base7 : dimText,
          minHeight: "unset",
          paddingTop: "11px",
          paddingBottom: "9px",
          paddingLeft: "10px",
          paddingRight: "10px",
          display: "flex",
          alignItems: "center",
          borderBottom: `1px solid ${divider}`,
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
    MuiListSubheader: {
      styleOverrides: {
        root: {
          ...capBoxSx,
          fontFamily: monoFontFamily,
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          lineHeight: 1.4,
          color: dimText,
          backgroundColor: c.bgAlt,
          padding: "10px 10px 10px",
          borderBottom: `1px solid ${divider}`,
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
        "@media (pointer: coarse)": {
          "input, textarea, select": { fontSize: "16px !important" },
        },
        "a:not(.MuiButtonBase-root):focus-visible": {
          outline: `2px solid ${c.blue}`,
          outlineOffset: 2,
          borderRadius: 2,
        },
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
  }
}
