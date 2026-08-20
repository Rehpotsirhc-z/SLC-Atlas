// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export const PRESETS = {
  ultrawide: { width: 3440, height: 1440, deviceScaleFactor: 1, isMobile: false },
  "4k": { width: 3840, height: 2160, deviceScaleFactor: 1, isMobile: false },
  hd: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
  phone: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
}

export const PRESET_NAMES = Object.keys(PRESETS)
