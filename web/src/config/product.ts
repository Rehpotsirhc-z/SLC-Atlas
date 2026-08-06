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

export const PRODUCT_NAME = "SLC Atlas"

export const ATLAS_DEFAULTS: AtlasConfig = {
  name: PRODUCT_NAME,
  shortName: PRODUCT_NAME,
  description: "",
  familyLabel: "gene",
  downloadPrefix: "atlas",
}

export function resolveAtlasConfig(env: Record<string, string | undefined>): AtlasConfig {
  return {
    name: env.ATLAS_APP_NAME || ATLAS_DEFAULTS.name,
    shortName: env.ATLAS_APP_SHORT_NAME || ATLAS_DEFAULTS.shortName,
    description: env.ATLAS_APP_DESCRIPTION || ATLAS_DEFAULTS.description,
    familyLabel: env.ATLAS_FAMILY_LABEL || ATLAS_DEFAULTS.familyLabel,
    downloadPrefix: env.ATLAS_DOWNLOAD_PREFIX || ATLAS_DEFAULTS.downloadPrefix,
  }
}
