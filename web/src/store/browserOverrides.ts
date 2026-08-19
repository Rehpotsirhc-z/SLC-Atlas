// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

// Shared links override browser settings only for the current visit
// Keep saved values here so URL settings are never written back to storage

import type { BrowserPrefs, GeneTrackMode } from "@/types/browser"

let prefOverrides: Partial<BrowserPrefs> = {}
let modeOverride: GeneTrackMode | null = null

export function overridePref<K extends keyof BrowserPrefs>(key: K, remembered: BrowserPrefs[K]) {
  if (!(key in prefOverrides)) prefOverrides = { ...prefOverrides, [key]: remembered }
}

export function overrideMode(remembered: GeneTrackMode) {
  modeOverride ??= remembered
}

export function clearPrefOverrides(keys: readonly (keyof BrowserPrefs)[]) {
  for (const key of keys) delete prefOverrides[key]
}

export function clearModeOverride() {
  modeOverride = null
}

export function persistedBrowserState(prefs: BrowserPrefs, mode: GeneTrackMode) {
  return {
    browserPrefs: { ...prefs, ...prefOverrides },
    browserMode: modeOverride ?? mode,
  }
}
