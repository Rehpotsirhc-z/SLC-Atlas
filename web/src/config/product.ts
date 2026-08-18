// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export interface AtlasConfig {
  name: string
  shortName: string
  description: string
  familyLabel: string
  downloadPrefix: string
}

export const PRODUCT_NAME = "AtlasForge"

export const ATLAS_DEFAULTS: AtlasConfig = {
  name: PRODUCT_NAME,
  shortName: PRODUCT_NAME,
  description: "",
  familyLabel: "gene",
  downloadPrefix: "atlasforge",
}

export function resolveAtlasConfig(env: Record<string, string | undefined>): AtlasConfig {
  return {
    name: env.ATLASFORGE_APP_NAME || ATLAS_DEFAULTS.name,
    shortName: env.ATLASFORGE_APP_SHORT_NAME || ATLAS_DEFAULTS.shortName,
    description: env.ATLASFORGE_APP_DESCRIPTION || ATLAS_DEFAULTS.description,
    familyLabel: env.ATLASFORGE_FAMILY_LABEL || ATLAS_DEFAULTS.familyLabel,
    downloadPrefix: env.ATLASFORGE_DOWNLOAD_PREFIX || ATLAS_DEFAULTS.downloadPrefix,
  }
}
