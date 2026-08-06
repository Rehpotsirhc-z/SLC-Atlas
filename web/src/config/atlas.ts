// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { ATLAS_DEFAULTS, type AtlasConfig } from "./product"

function read(): AtlasConfig {
  const island = document.getElementById("atlas-config")?.textContent
  if (!island) return ATLAS_DEFAULTS
  try {
    return { ...ATLAS_DEFAULTS, ...JSON.parse(island) }
  } catch {
    return ATLAS_DEFAULTS
  }
}

export const atlas = read()
