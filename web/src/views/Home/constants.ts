// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import type { RoutePath } from "@/config/routes"
import type { DoomColors } from "@/theme/palette"

export type AccentKey = keyof DoomColors

export const VIEW_ACCENT: Record<RoutePath, AccentKey> = {
  "/genes": "blue",
  "/clustering": "teal",
  "/conservation": "green",
  "/browser": "violet",
  "/expression": "magenta",
  "/structure": "orange",
}

export const HOME_MAX_WIDTH = 940
export const SEARCH_MAX_WIDTH = 560
export const TILE_MIN_WIDTH = 260
