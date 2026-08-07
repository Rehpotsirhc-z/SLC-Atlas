// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { darken } from "@mui/material/styles"

export type ThemeMode = "light" | "dark"

// Doom One and its official light sibling Doom One Light
// https://github.com/doomemacs/themes/tree/master/themes
export const doomColors = {
  dark: {
    bg: "#282c34",
    bgAlt: "#21242b",
    base3: "#23272e",
    base4: "#3f444a",
    base5: "#5B6268",
    base6: "#73797e",
    base7: "#9ca0a4",
    fg: "#bbc2cf",
    red: "#ff6c6b",
    orange: "#da8548",
    green: "#98be65",
    teal: "#4db5bd",
    yellow: "#ECBE7B",
    blue: "#51afef",
    magenta: "#c678dd",
    violet: "#a9a1e1",
    cyan: "#46D9FF",
    darkCyan: "#5699AF",
  },
  light: {
    bg: "#fafafa",
    bgAlt: "#f0f0f0",
    base3: "#c6c7c7",
    base4: "#9ca0a4",
    base5: "#383a42",
    base6: "#202328",
    base7: "#1c1f24",
    fg: "#383a42",
    red: "#e45649",
    orange: "#da8548",
    green: "#50a14f",
    teal: "#4db5bd",
    yellow: "#986801",
    blue: "#4078f2",
    magenta: "#a626a4",
    violet: "#b751b6",
    cyan: "#0184bc",
    darkCyan: "#005478",
  },
} as const

export type DoomColors = (typeof doomColors)[ThemeMode]

export const dividerFor = (mode: ThemeMode) =>
  mode === "dark" ? doomColors.dark.base4 : doomColors.light.base3

export const secondaryTextFor = (mode: ThemeMode) =>
  mode === "dark" ? doomColors.dark.base6 : darken(doomColors.light.base4, 0.15)
